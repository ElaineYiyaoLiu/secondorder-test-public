import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {distributionEmbedding,distributionComparison,distributionDistance,empiricalW1,DISTRIBUTION_MODEL} from '../public/return-distribution.js';
import {makeEngine,tournament,GEOMETRIES} from '../public/legacy-engine.js';
import {sampleDataset} from '../public/data.js';
import {fromReturns,generator} from '../scripts/relation-fixtures.mjs';
const close=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);
const rows=r=>fromReturns([r]).S0,embed=(r,ablation=null)=>distributionEmbedding(rows(r),{ablation});
test('exact transport covers unequal counts, repeated values and known fractional tails',()=>{
 close(empiricalW1([0,1,3],[5,6,8]),5);close(empiricalW1([0,2],[1]),1);close(empiricalW1([0,0,2],[0,1]),.5);
 close(empiricalW1(Array(9).fill(0),[-.09,...Array(8).fill(0)],{lower:0,upper:.2}),.05);
 const a=embed(Array(9).fill(0),'no-transform'),b=embed([-.09,...Array(8).fill(0)],'no-transform'),d=distributionComparison(a,b);close(d.channels.bulk,1);close(d.channels.lower,5);close(d.channels.upper,0);close(d.distance,1.6);close(d.rawW1,.01);
});
test('replicating an empirical distribution changes sample count but not its distance',()=>{
 const r=[-.02,-.01,-.01,0,0,.01,.02,.03,.04],a=embed(r),b=embed(r.flatMap(x=>[x,x]));close(distributionDistance(a,b),0,1e-12);
});
test('flat and nearly flat distributions stay defined; fractional ES preserves signs',()=>{
 const a=embed(Array(9).fill(0)),b=embed(Array(9).fill(.00000000001));assert.equal(a.model,DISTRIBUTION_MODEL);close(a.summary.zeroFraction,1);close(a.summary.dailyRisk,0);assert.ok(distributionDistance(a,b)>0);close(a.summary.tailObservations,1.8);
 const c=embed([-.09,...Array(8).fill(0)]);close(c.summary.lowerTailMean,-.05);close(c.summary.upperTailMean,0);
});
test('price rebasing and time permutations preserve distributions without removing risk or drift',()=>{
 const r=[-.04,-.01,0,0,.01,.02,.04,.01,-.02],a=embed(r),rebased=rows(r);for(const x of rebased)x.close*=1e5;close(distributionDistance(a,distributionEmbedding(rebased)),0,1e-10);close(distributionDistance(a,embed([...r].reverse())),0,1e-10);assert.ok(distributionDistance(a,embed(r.map(x=>2*x)))>.1);assert.ok(distributionDistance(a,embed(r.map(x=>x+.01)))>.1);
});
test('tail changes receive more weight than equal central quantile movement',()=>{
 const a=embed(Array(19).fill(0),'no-transform'),tail=embed([-.01,...Array(18).fill(0)],'no-transform'),center=embed([...Array(10).fill(0),.01,...Array(8).fill(.01)],'no-transform');
 // Independent channel formula, including partial empirical tail bins.
 const d=distributionComparison(a,tail);close(d.distance,1.6/19);close(d.contributions.bulk,.6/19);close(d.contributions.lower,1/19);close(d.contributions.upper,0);
 assert.ok(distributionDistance(a,center)>0);
 const ordered=Array.from({length:19},(_,i)=>(i-9)*.01),tailMove=[...ordered],centralMove=[...ordered];tailMove[0]-=.001;centralMove[9]+=.001;close(distributionDistance(embed(ordered,'no-transform'),embed(tailMove,'no-transform')),1.6*.1/19);close(distributionDistance(embed(ordered,'no-transform'),embed(centralMove,'no-transform')),.6*.1/19);
});
test('smooth transform reduces isolated extremes while keeping them distinguishable',()=>{
 const r=Array(29).fill(0),a=embed(r),b=embed([.5,...r.slice(1)]),c=embed([1,...r.slice(1)]),rawA=embed(r,'no-transform'),rawB=embed([.5,...r.slice(1)],'no-transform');assert.ok(distributionDistance(a,b)<distributionDistance(rawA,rawB));assert.ok(distributionDistance(a,c)>distributionDistance(a,b));assert.ok(b.summary.maxAbsLogReturn>.49);
});
test('500 unequal-length random triples satisfy symmetry, triangle, identity and sign reflection',()=>{
 const rng=generator(13091);
 for(let i=0;i<500;i++){
  const values=n=>Array.from({length:n},()=>.02*rng.normal()),ra=values(9+i%111),rb=values(9+(i*7)%111),rc=values(9+(i*13)%111),a=embed(ra),b=embed(rb),c=embed(rc),d=distributionDistance(a,b);close(d,distributionDistance(b,a));close(distributionDistance(a,a),0);assert.ok(distributionDistance(a,c)<=d+distributionDistance(b,c)+1e-9);close(d,distributionDistance(embed(ra.map(x=>-x)),embed(rb.map(x=>-x))),1e-9);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
 }
});
test('extreme finite positive prices and minimum/maximum windows remain finite',()=>{
 for(const n of [10,120]){const a=distributionEmbedding(Array.from({length:n},(_,i)=>({date:String(i).padStart(3,'0'),close:i%2?1e300:1e-300})));assert.ok(a.logReturns.every(Number.isFinite));assert.ok(a.transformed.every(Number.isFinite));close(distributionDistance(a,a),0);}
});
test('malformed windows, sparse samples, corrupt representations and variants reject',()=>{
 const valid=rows(Array(9).fill(.01));for(const change of [a=>{a[1].close=0;},a=>{a[1].close=NaN;},a=>{a[1].date=a[0].date;},a=>{delete a[1];}]){const a=structuredClone(valid);change(a);assert.throws(()=>distributionEmbedding(a));}
 for(const a of [[],[NaN],[Infinity],Array(3)])assert.throws(()=>empiricalW1(a,[0]));assert.throws(()=>empiricalW1([0],[0],{lower:.8,upper:.2}));assert.throws(()=>empiricalW1([-1e308],[1e308]));assert.throws(()=>distributionEmbedding(valid,{ablation:'bad'}));
 const a=embed(Array(9).fill(.01));for(const b of [{...a,n:30},{...a,transformed:Array(9)},{...a,logReturns:[...a.logReturns].reverse().map((x,i)=>x+i)},{...a,model:'fake'}])assert.throws(()=>distributionDistance(a,b));assert.throws(()=>distributionDistance(a,{...a,ablation:'uniform'}));
});
test('seven other geometries retain exact v0.5 representations and retrieval rankings',()=>{
 const ids=GEOMETRIES.filter(g=>g.id!=='wasserstein').map(g=>g.id),b=makeEngine(sampleDataset(),'NVDA',{relationEvidence:'legacy',topologyModel:'legacy',hierarchyModel:'legacy',signatureModel:'legacy'}).find(470,499,ids),a=JSON.parse(readFileSync(new URL('./v05-other-geometries.json',import.meta.url))),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');assert.equal(hash(b.rankings),a.rankings);for(const id of ids)assert.equal(hash(b.target[id]),a.targets[id]);
});
test('future prices, volumes and dates do not alter an earlier distribution search',()=>{
 const ds=sampleDataset(),a=makeEngine(ds,'NVDA').find(370,399,['wasserstein']),bad=structuredClone(ds);for(const x of bad.NVDA.slice(400)){for(const k of ['open','high','low','close'])x[k]*=3;x.volume*=2;}bad.AAPL[480].date='2099-01-01';assert.deepEqual(makeEngine(bad,'NVDA').find(370,399,['wasserstein']),a);assert.ok(a.rankings.wasserstein.every(x=>x.end+60<370));
});
test('legacy diagnostic matches raw sorted-return arithmetic and default variants validate',()=>{
 const ds=sampleDataset(),e=makeEngine(ds,'NVDA',{distributionModel:'legacy'}),a=e.get(470,499).wasserstein,b=e.get(0,29).wasserstein;close(a.reduce((s,x,i)=>s+Math.abs(x-b[i]),0)/a.length,empiricalW1(a,b));assert.throws(()=>makeEngine(ds,'NVDA',{distributionModel:'bad'}));assert.throws(()=>makeEngine(ds,'NVDA',{distributionModel:'legacy',distributionAblation:'uniform'}));
});
test('walk-forward predictions remain past-only after future observations change',async()=>{
 const ds=sampleDataset(),a=await tournament(makeEngine(ds,'NVDA'),['wasserstein']),bad=structuredClone(ds);for(const xs of Object.values(bad))for(const x of xs.slice(310))for(const k of ['open','high','low','close'])x[k]*=2;const b=await tournament(makeEngine(bad,'NVDA'),['wasserstein']);assert.equal(a[0].records[0].prediction,b[0].records[0].prediction);assert.equal(a[0].records[0].base,b[0].records[0].base);
});

