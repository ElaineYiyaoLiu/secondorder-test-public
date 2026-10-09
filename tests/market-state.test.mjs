import test from 'node:test';
import assert from 'node:assert/strict';
import {marketEmbedding,marketDistance,marketComparison,spdDistance,spdComparison,MARKET_MODEL} from '../public/market-state.js';
import {makeEngine,tournament,GEOMETRIES} from '../public/legacy-engine.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sampleDataset} from '../public/data.js';
import {estimationFixture,fromReturns,generator} from '../scripts/relation-fixtures.mjs';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);
const embed=ds=>marketEmbedding(Object.values(ds),Object.keys(ds));
const fixture=(seed=11,n=30,p=6)=>estimationFixture(seed,'factor',n,p).dataset;
const mul=(a,b)=>a.map(r=>b[0].map((_,j)=>r.reduce((s,x,k)=>s+x*b[k][j],0)));
const tr=a=>a[0].map((_,j)=>a.map(r=>r[j]));
const transform=(a,t)=>mul(mul(t,a),tr(t));
test('SPD diagonal oracle works across extreme absolute scales without eigenvalue floors',()=>{
 for(const scale of [1e-280,1e-20,1,1e200]){const a=[[scale,0],[0,2*scale]],b=[[4*scale,0],[0,8*scale]];close(spdDistance(a,b),Math.sqrt(2)*Math.log(4));close(spdDistance(a,a),0);}
 close(spdDistance([[1e-280]],[[1e200]]),480*Math.log(10),1e-10);
 const x=spdComparison([[1,0],[0,2]],[[4,0],[0,8]]);close(x.normalized,Math.log(4));close(x.shapeDistance,0);close(x.logVolumeRatio,Math.log(4));
});
test('SPD invalid, asymmetric, indefinite, singular and sparse matrices fail explicitly',()=>{
 for(const x of [[],[[0]],[[1,2],[2,1]],[[1,1],[1,1]],[[1,2],[1,2]],[[NaN]],[[Infinity]],Array(2),[[1,0],Array(2)]])assert.throws(()=>spdDistance(x,x));
 assert.throws(()=>spdDistance([[1]],[[1,0],[0,1]]));
});
test('extreme prices and duplicate asset paths remain finite; low variation is excluded',()=>{
 const rows=Array.from({length:10},(_,i)=>({date:String(i).padStart(3,'0'),close:i%2?1e280:1e-280})),a=marketEmbedding(Array.from({length:12},()=>rows),Array.from({length:12},(_,i)=>'A'+String(i).padStart(2,'0')));assert.equal(a.available,true);assert.ok(a.covariance.flat().every(Number.isFinite));close(marketDistance(a,a),0,1e-7);
 const low=Array.from({length:10},(_,i)=>({date:String(i).padStart(3,'0'),close:100*Math.exp(i%2?1e-13:0)}));assert.equal(marketEmbedding([low,low,low],['A','B','C']).available,false);
});
test('500 random SPD triples satisfy identity, symmetry, triangle and congruence',()=>{
 const rng=generator(9981);
 for(let i=0;i<500;i++){
  const p=1+i%12,spd=()=>{const t=Array.from({length:p},()=>Array.from({length:p},()=>rng.normal()));return mul(t,tr(t)).map((r,j)=>r.map((x,k)=>x+(j===k?.3:0)));},a=spd(),b=spd(),c=spd();
  const d=spdDistance(a,b);close(d,spdDistance(b,a));close(spdDistance(a,a),0,1e-7);assert.ok(spdDistance(a,c)<=d+spdDistance(b,c)+1e-7);
  if(i%10===0){const t=Array.from({length:p},(_,j)=>Array.from({length:p},(_,k)=>j===k?1.5:j>k?.08*rng.normal():0));close(d,spdDistance(transform(a,t),transform(b,t)),1e-7);}
 }
});
test('market representations are canonical, finite, positive definite and serializable',()=>{
 for(const p of [3,6,12])for(const n of [10,30,120]){const ds=fixture(23,n,p),a=embed(ds),keys=Object.keys(ds).reverse(),b=marketEmbedding(keys.map(s=>ds[s]),keys);assert.equal(a.model,MARKET_MODEL);assert.deepEqual(a,b);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);close(marketDistance(a,b),0);assert.ok(a.shrinkage>=.02&&a.shrinkage<=1);assert.ok(a.conditionBound<=600);}
});
test('price rebasing and drift leave covariance unchanged, return scaling retains risk',()=>{
 const ds=fixture(),a=embed(ds),rebased=structuredClone(ds);
 for(const [j,rows] of Object.values(rebased).entries())for(const [i,r] of rows.entries())r.close*=Math.exp(.004*i)*(j+1)*7;
 close(marketDistance(a,embed(rebased)),0,1e-10);
 const r=Object.values(ds).map(rows=>rows.slice(1).map((x,i)=>2*(Math.log(x.close)-Math.log(rows[i].close)))),b=embed(fromReturns(r));
 close(marketDistance(a,b),Math.log(4),1e-9);close(marketComparison(a,b).shapeDistance,0,1e-7);
});
test('flat assets are unavailable, malformed labels, dates and closes are rejected',()=>{
 const ds=fixture();for(const r of ds.S0)r.close=100;assert.equal(embed(ds).available,false);assert.deepEqual(embed(ds).invalidAssets,['S0']);assert.throws(()=>marketDistance(embed(ds),embed(ds)));
 for(const mutation of [d=>{d.S0[2].close=0;},d=>{d.S0[2].close=Infinity;},d=>{d.S1[2].date=d.S1[1].date;},d=>{delete d.S1[2];}]){const d=fixture();mutation(d);assert.throws(()=>embed(d));}
 assert.throws(()=>marketEmbedding(Object.values(fixture()),['X','X','A','B','C','D']));assert.throws(()=>marketEmbedding(Object.values(fixture()),Array(6)));
});
test('comparison checks asset identity, length and model variant',()=>{
 const a=embed(fixture());assert.throws(()=>marketDistance(a,embed(fixture(11,31))));assert.throws(()=>marketDistance(a,{...a,symbols:a.symbols.map(s=>'Z'+s)}));assert.throws(()=>marketDistance(a,{...a,ablation:'no-winsor'}));assert.throws(()=>marketDistance(a,{...a,covariance:Array(6)}));
});
test('outlier handling is reported and suppresses isolated corruption',()=>{
 const ds=fixture(100,120),a=embed(ds),bad=structuredClone(ds);bad.S0[50].close*=Math.exp(2);const b=embed(bad),raw=marketEmbedding(Object.values(bad),Object.keys(bad),{ablation:'no-winsor'});
 assert.ok(b.clippedReturns[0]>=2);assert.ok(marketDistance(a,b)<marketDistance({...a,ablation:'no-winsor'},raw));
});
test('constant target disables only its undefined geometries; candidate coverage excludes unavailable windows',()=>{
 const ds=sampleDataset();for(const r of ds.NVDA.slice(470,500))r.close=100;const q=makeEngine(ds,'AAPL').find(470,499,GEOMETRIES.map(g=>g.id));assert.ok(!q.active.includes('riemannian'));assert.ok(q.active.includes('dtw'));assert.equal(q.target.marketState.available,false);
 const other=sampleDataset();for(const r of other.NVDA.slice(0,100)){r.close=r.open=100;r.high=101;r.low=99;}const x=makeEngine(other,'NVDA').find(470,499,['riemannian']);assert.ok(x.methodCandidateCount.riemannian<x.candidateCount);assert.ok(x.rankings.riemannian.every(c=>Number.isFinite(c.scores.riemannian)));
});
test('future prices and date mismatches never alter past market searches',()=>{
 const ds=sampleDataset(),a=makeEngine(ds,'NVDA').find(370,399,['riemannian']),bad=structuredClone(ds);for(const rows of Object.values(bad))for(const r of rows.slice(400))r.close*=4;bad.AAPL[480].date='2099-01-01';assert.deepEqual(makeEngine(bad,'NVDA').find(370,399,['riemannian']),a);
});
test('v0.4 snapshot remains reproducible with the legacy distribution diagnostic',()=>{
 const ds=sampleDataset(),ids=GEOMETRIES.filter(g=>g.id!=='riemannian').map(g=>g.id),b=makeEngine(ds,'NVDA',{relationEvidence:'legacy',distributionModel:'legacy',topologyModel:'legacy',hierarchyModel:'legacy',signatureModel:'legacy'}).find(470,499,ids),a=JSON.parse(readFileSync(new URL('./v04-other-geometries.json',import.meta.url))),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');assert.equal(hash(b.rankings),a.rankings);for(const id of ids)assert.equal(hash(b.target[id]),a.targets[id]);
});
test('market walk-forward predictions remain past-only and variants validate',async()=>{
 const ds=sampleDataset(),a=await tournament(makeEngine(ds,'NVDA'),['riemannian']),bad=structuredClone(ds);for(const rows of Object.values(bad))for(const r of rows.slice(310))for(const key of ['open','high','low','close'])r[key]*=2;const b=await tournament(makeEngine(bad,'NVDA'),['riemannian']);assert.ok(a[0].n>0);assert.equal(a[0].records[0].prediction,b[0].records[0].prediction);assert.equal(a[0].records[0].base,b[0].records[0].base);assert.throws(()=>makeEngine(ds,'NVDA',{marketModel:'wrong'}));assert.throws(()=>makeEngine(ds,'NVDA',{marketModel:'legacy',marketAblation:'no-winsor'}));
});

