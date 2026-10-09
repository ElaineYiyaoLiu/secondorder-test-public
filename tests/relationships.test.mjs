import test from 'node:test';
import assert from 'node:assert/strict';
import {relationEmbedding,relationDistance,relationContributions,relationHasEvidence,averageRanks,oasCorrelation,RELATION_CONFIG as C} from '../public/relationships.js';
import {makeEngine,tournament,eigen} from '../public/legacy-engine.js';
import {sampleDataset} from '../public/data.js';
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const fixture=sampleDataset(),names=['AMZN','MSFT','NVDA'],basket=names.map(s=>fixture[s].slice(0,30));
const embed=(b=basket,s=names,opts)=>relationEmbedding(b,s,opts);
const fromReturns=(series)=>series.map((r,j)=>{let p=100;return [p,...r.map(x=>p*=Math.exp(x))].map((close,i)=>({date:String(i).padStart(6,'0'),close}));});
test('average ranks handle exact ties, reversal and invalid or sparse values',()=>{
 assert.deepEqual(averageRanks([3,1,1,2]),[3,.5,.5,2]);assert.deepEqual(averageRanks([7,7,7]),[1,1,1]);
 for(const a of [null,[],Array(3),[NaN],[Infinity]])assert.throws(()=>averageRanks(a));
});
test('OAS original finite-dimension formula matches independently known matrices',()=>{
 const r=[[1,.5,.5],[.5,1,.5],[.5,.5,1]],a=oasCorrelation(r,9);near(a.shrinkage,.75);near(a.matrix[0][1],.125);
 const identity=[[1,0,0],[0,1,0],[0,0,1]];assert.equal(oasCorrelation(identity,9).shrinkage,1);
 assert.ok(oasCorrelation(r,119).shrinkage<a.shrinkage);assert.deepEqual(oasCorrelation(r,9,{shrink:false}).matrix,r);
 const perfect=Array.from({length:3},()=>Array(3).fill(1));near(oasCorrelation(perfect,9).shrinkage,3/14);
 for(const matrix of [Array(3),[[1,1,1],[1,1,-1],[1,-1,1]],[[1,2,0],[2,1,0],[0,0,1]],[[1,0],[0,1]],[[0,0,0],[0,1,0],[0,0,1]]])assert.throws(()=>oasCorrelation(matrix,9));
});
test('price units and input asset order do not change labelled relationships',()=>{
 const a=embed();for(const factor of [1e-150,.001,1e150])near(relationDistance(a,embed(basket.map((rows,j)=>rows.map(r=>({...r,close:r.close*factor*(j+1)}))))),0);
 assert.deepEqual(a,embed([...basket].reverse(),[...names].reverse()));assert.deepEqual(a,JSON.parse(JSON.stringify(a)));
 assert.throws(()=>relationDistance(a,embed(basket,['AMZN','MSFT','OTHER'])));
});
test('off-diagonal distance has exact weights without diagonal dilution',()=>{
 const a=embed(),b=structuredClone(a);b.vector=b.vector.map((x,i)=>x+(i<a.vector.length/2?.01:.02));
 const r=relationContributions(a,b),e=3;near(r.squared.linear,e*.01**2);near(r.squared.rank,e*.02**2);near(r.distance,Math.sqrt(e*(.01**2+.02**2)));
 // Every edge counts once. Matrix diagonals are never distance coordinates.
 assert.equal(a.vector.length,names.length*(names.length-1));
});
test('constant and nearly constant return assets are unavailable, not independent',()=>{
 for(const series of [Array(29).fill(0),Array(29).fill(.01),Array.from({length:29},(_,i)=>1e-14*Math.sin(i))]){
  const b=fromReturns([series,Array.from({length:29},(_,i)=>.01*Math.sin(i)),Array.from({length:29},(_,i)=>.01*Math.cos(i))]),a=embed(b,names);assert.equal(a.available,false);assert.ok(a.invalidAssets.includes(names[0]));assert.throws(()=>relationDistance(a,a));
 }
});
test('invalid aligned data, symbols, variants and sparse channels reject explicitly',()=>{
 for(const change of [b=>{b[0][5].close=0;},b=>{b[1][5].close=NaN;},b=>{b[1][5].date='wrong';},b=>{b[0][5].date=b[0][4].date;},b=>{delete b[1][5];},b=>{b[2].pop();}]){const b=structuredClone(basket);change(b);assert.throws(()=>embed(b));}
 for(const s of [['A','A','B'],Array(3),['A','B'],['A','B',null]])assert.throws(()=>embed(basket,s));
 assert.throws(()=>embed(Array(3),names));assert.throws(()=>embed(basket,names,{ablation:'unknown'}));
 const a=embed();for(const b of [{...a,n:31},{...a,vector:Array(a.vector.length)},{...a,model:'wrong'},{...a,ablation:'different'},{...a,symbols:['AMZN','AMZN','NVDA']}])assert.throws(()=>relationDistance(a,b));
 for(const opts of [{relationModel:'wrong'},{relationAblation:'wrong'},{relationModel:'legacy',relationAblation:'no-shrink'}])assert.throws(()=>makeEngine(fixture,'NVDA',opts));
});
test('500 random triples: PSD, bounded matrices, unit diagonals, metric on embeddings',()=>{
 let seed=4381;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let k=0;k<500;k++){
  const p=3+Math.floor(rand()*10),m=9+Math.floor(rand()*111),s=Array.from({length:p},(_,i)=>`S${String(i).padStart(2,'0')}`);
  const random=()=>embed(fromReturns(Array.from({length:p},()=>Array.from({length:m},()=>.02*(rand()-.5)))),s),a=random(),b=random(),c=random(),ab=relationDistance(a,b);
  assert.ok(Number.isFinite(ab)&&ab>=0);near(relationDistance(a,a),0);near(ab,relationDistance(b,a));assert.ok(relationDistance(a,c)<=ab+relationDistance(b,c)+1e-12);
  for(const matrix of [a.linear,a.rank]){for(let i=0;i<p;i++){near(matrix[i][i],1);for(let j=0;j<p;j++){near(matrix[i][j],matrix[j][i]);assert.ok(Math.abs(matrix[i][j])<=1+1e-12);}}assert.ok(Math.min(...eigen(matrix).values)>-1e-8);}
  assert.ok(a.shrinkage.linear>=0&&a.shrinkage.linear<=1);assert.ok(a.shrinkage.rank>=0&&a.shrinkage.rank<=1);
 }
});
test('synchronous time permutation preserves relations; changing one asset order can change them',()=>{
 const series=Array.from({length:3},(_,j)=>Array.from({length:29},(_,i)=>.01*Math.sin(i*.7)+.002*Math.cos(i*(j+1))));
 const a=embed(fromReturns(series)),permutation=Array.from({length:29},(_,i)=>28-i);
 const b=embed(fromReturns(series.map(r=>permutation.map(i=>r[i]))));near(relationDistance(a,b),0);
 const c=embed(fromReturns(series.map((r,i)=>i?[...r]:[...r].reverse())));assert.ok(relationDistance(a,c)>0);
});
test('one joint extreme shock is clipped and rank channel remains bounded',()=>{
 const a=embed(),b=structuredClone(basket);for(const rows of b)for(let i=15;i<rows.length;i++)rows[i].close*=1e100;
 const r=embed(b);assert.ok(r.clippedReturns.every(n=>n>0));assert.ok(r.vector.every(Number.isFinite));assert.ok(relationDistance(a,r)<relationDistance(embed(basket,names,{ablation:'no-winsor'}),embed(b,names,{ablation:'no-winsor'})));
});
test('future misalignment and appended data cannot disable past relationship retrieval',async()=>{
 const before=makeEngine(fixture,'NVDA').find(400,429,['correlation']),changed=structuredClone(fixture);for(const s of Object.keys(changed)){for(let i=430;i<changed[s].length;i++)changed[s][i].date=`future-${s}-${i}`;changed[s].push({...changed[s].at(-1),date:`last-${s}`});}
 const after=makeEngine(changed,'NVDA').find(400,429,['correlation']);assert.deepEqual(after,before);
 const one=(await tournament(makeEngine(fixture,'NVDA'),['correlation']))[0],two=(await tournament(makeEngine(changed,'NVDA'),['correlation']))[0];
 for(const r of one.records.filter(r=>r.date<=fixture.NVDA[429].date)){const other=two.records.find(x=>x.date===r.date);near(other.prediction,r.prediction);}
});
test('undefined candidate correlations are skipped and undefined targets do not vote',()=>{
 const changed=structuredClone(fixture);for(const r of changed.AAPL.slice(0,130))r.close=r.open=r.high=r.low=100;
 const e=makeEngine(changed,'NVDA'),r=e.find(400,429,['correlation']);assert.ok(r.methodCandidateCount.correlation<r.candidateCount);assert.ok(r.rankings.correlation.every(c=>c.start>100&&Number.isFinite(c.scores.correlation)));
 const no=e.find(50,79,['correlation','dtw']);assert.deepEqual(no.active,['dtw']);assert.equal(no.target.relationship.available,false);
});
test('current-window basket date mismatch disables basket methods without crashing',()=>{
 const b=structuredClone(fixture);b.AAPL[410].date='mismatch';const e=makeEngine(b,'NVDA'),r=e.find(400,429,['correlation','riemannian','topology','dtw']);assert.deepEqual(r.active,['dtw']);
 const a=structuredClone(fixture);a.AAPL[40].date='mismatch';assert.ok(makeEngine(a,'NVDA').find(400,429,['riemannian','topology','correlation']).analogues.length>0);
});

test('complete shrinkage can collapse noisy weak relationships to one representation',()=>{
 const a=embed();assert.equal(a.shrinkage.linear,1);assert.equal(a.shrinkage.rank,1);assert.ok(a.vector.every(x=>Object.is(x,0)));
 // This is an independence prior under weak evidence, not proof of independence.
});
test('extreme finite prices, duplicate asset paths and signed relationships remain valid',()=>{
 const values=Array.from({length:30},(_,i)=>({date:String(i).padStart(3,'0'),close:i%2?1e300:1e-300}));const a=embed([values,values,[...values].map(r=>({...r,close:1/r.close}))]);assert.ok(a.available);assert.ok(a.vector.every(Number.isFinite));assert.ok(a.linear[0][1]>0);assert.ok(a.linear[0][2]<0);near(relationDistance(a,a),0);
});
test('rank channel is invariant to strictly increasing return transformations without shrinkage',()=>{
 const series=Array.from({length:3},(_,j)=>Array.from({length:29},(_,i)=>.01*Math.sin(i*(j+1))));
 const a=embed(fromReturns(series),names,{ablation:'no-shrink'}),b=embed(fromReturns(series.map(r=>r.map(x=>x+x**3*1000))),names,{ablation:'no-shrink'});
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)near(a.rank[i][j],b.rank[i][j]);
});
test('sparse search and Lab method lists reject instead of silently losing an ID',async()=>{
 const e=makeEngine(fixture,'NVDA');assert.throws(()=>e.find(400,429,Array(1)));await assert.rejects(()=>tournament(e,Array(1)));
});
import {forecastFixture} from '../scripts/relation-fixtures.mjs';
test('known 12-asset rank-deficient window does not fail PSD validation',()=>{
 const dataset=forecastFixture(1117,'switching',1780,12),symbols=Object.keys(dataset).sort(),a=relationEmbedding(symbols.map(s=>dataset[s].slice(1770,1780)),symbols);assert.equal(a.available,true);assert.ok(a.vector.every(Number.isFinite));
 assert.ok(Math.min(...eigen(a.linear).values)>-1e-8);assert.ok(Math.min(...eigen(a.rank).values)>-1e-8);
});


test('fully shrunk query produces no relationship recommendations or consensus votes',()=>{
 const r=makeEngine(fixture,'NVDA').find(470,499,['correlation','dtw']);
 assert.equal(r.target.relationship.available,true);assert.equal(r.target.relationshipInformative,false);
 assert.equal(r.target.correlation.model,'asset-relationships-v2');assert.deepEqual(r.active,['dtw']);assert.deepEqual(r.skipped,['correlation']);
 assert.equal(r.rankings.correlation,undefined);assert.ok(r.analogues.length>0);assert.ok(r.analogues.every(c=>!c.votes.includes('correlation')));
 const only=makeEngine(fixture,'NVDA').find(470,499,['correlation']);assert.deepEqual(only.active,[]);assert.deepEqual(only.analogues,[]);
});
test('informative query excludes fully shrunk historical candidates without disabling valid matches',()=>{
 const e=makeEngine(fixture,'NVDA'),r=e.find(400,429,['correlation']);
 assert.equal(r.target.relationshipInformative,true);assert.ok(r.active.includes('correlation'));assert.ok(r.rankings.correlation.length>0);
 assert.ok(r.methodCandidateCount.correlation<r.candidateCount);
 assert.ok(r.rankings.correlation.every(c=>e.get(c.start,c.end).relationshipInformative));
 let eligible=0;for(let end=29;end+60<400;end+=5)if(e.get(end-29,end).relationshipInformative)eligible++;
 assert.equal(r.methodCandidateCount.correlation,eligible);
});

test('evidence eligibility follows active channel weights and preserves old diagnostics explicitly',()=>{
 const base={available:true,ablation:null,shrinkage:{linear:1,rank:.5}};
 assert.equal(relationHasEvidence(base),true);assert.equal(relationHasEvidence({...base,ablation:'linear-only'}),false);
 assert.equal(relationHasEvidence({...base,available:false}),false);assert.equal(relationHasEvidence({...base,shrinkage:{linear:.5,rank:1}}),true);
 assert.throws(()=>makeEngine(fixture,'NVDA',{relationEvidence:'unknown'}));
 const legacy=makeEngine(fixture,'NVDA',{relationEvidence:'legacy'}).find(470,499,['correlation']);assert.ok(legacy.rankings.correlation.some(c=>c.scores.correlation===0));
});

