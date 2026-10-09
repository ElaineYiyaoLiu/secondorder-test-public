import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEngine,ANALYSIS_IDS,validateHomology} from '../public/engine.js';
import {pathStats,riskAnalysis,resampleBasket} from '../public/analysis.js';
import {geometryEvidence} from '../public/evidence.js';
import {sampleDataset,validateDataset,parseCSV} from '../public/data.js';
const nearly=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
const fixture=prices=>prices.map((close,i)=>({date:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),open:close,high:close,low:close,close,volume:100+i}));
test('a ten-bar dataset supports current analysis without historical references',()=>{
 const rows=sampleDataset().NVDA.slice(0,10),dataset={NVDA:rows};validateDataset(dataset);const r=makeEngine(dataset,'NVDA').analyze(0,9);
 assert.deepEqual(r.models.map(m=>m.id),ANALYSIS_IDS);assert.ok(r.models.every(m=>m.computed));assert.equal(r.models.find(m=>m.id==='euclidean').evidence.code,'limited');assert.equal(r.models.find(m=>m.id==='correlation').evidence.code,'insufficient');assert.equal(r.models.find(m=>m.id==='ultrametric').evidence.code,'insufficient');assert.equal(r.analogues,undefined);assert.equal(r.consensus,undefined);
 assert.throws(()=>validateDataset({NVDA:rows.slice(0,9)}));
 const text='symbol,date,open,high,low,close,volume\n'+rows.map(r=>['NVDA',r.date,r.open,r.high,r.low,r.close,r.volume].join(',')).join('\n');assert.equal(parseCSV(text).NVDA.length,10);
});
test('known monotone and round-trip paths distinguish efficiency from drawdown',()=>{
 const a=pathStats(fixture([100,110,121])),b=pathStats(fixture([100,120,90,100]));nearly(a.efficiency,1);nearly(a.maxDrawdown,0);nearly(b.maxDrawdown,.25);nearly(b.efficiency,0);assert.equal(b.dropPeak,1);assert.equal(b.trough,2);
});
test('candles measure bodies and wicks independently of net price paths',()=>{
 const ds={NVDA:fixture(Array(30).fill(100)).map(r=>({...r,open:99,high:104,low:98}))},r=makeEngine(ds,'NVDA').analyze(0,29,['euclidean']).models[0];nearly(r.plot.body[0],1/6);nearly(r.plot.upper[0],4/6);nearly(r.plot.lower[0],1/6);assert.match(r.summary[0],/Upper/);
});
test('changing future prices, volume or asset dates cannot change current analysis or Homology',()=>{
 const ds=sampleDataset(),before=makeEngine(ds,'NVDA'),a=before.analyze(350,379),h=before.homology(350,379),changed=structuredClone(ds);
 for(const series of Object.values(changed))for(let i=380;i<series.length;i++){for(const k of ['open','high','low','close'])series[i][k]*=3;series[i].volume*=4;series[i].date='2099-'+series[i].date.slice(5);}
 const after=makeEngine(changed,'NVDA');assert.deepEqual(after.analyze(350,379),a);assert.deepEqual(after.homology(350,379),h);
});
test('basket dates align by selected dates, independent of array offsets',()=>{
 const ds=sampleDataset(),before=makeEngine(ds,'NVDA').analyze(470,499,['correlation','riemannian']);ds.AAPL=ds.AAPL.slice(1);const after=makeEngine(ds,'NVDA').analyze(470,499,['correlation','riemannian']);assert.deepEqual(after.models,before.models);
 ds.AAPL=ds.AAPL.filter(r=>r.date!==ds.NVDA[480].date);assert.ok(makeEngine(ds,'NVDA').analyze(470,499,['correlation','riemannian']).models.every(m=>m.evidence.code==='insufficient'));
});
test('equal-weight regularized risk contributions sum to one and raw risk is separately retained',()=>{
 const ds=sampleDataset(),names=Object.keys(ds).sort(),basket=names.map(s=>ds[s].slice(400,460)),r=riskAnalysis(basket,names);nearly(r.contributions.reduce((s,x)=>s+x,0),1);assert.ok(r.rawDailyVolatility>=0);assert.ok(r.regularizedDailyVolatility>0);assert.ok(r.weights.every(w=>w===1/names.length));
});
test('full shrinkage cannot become evidence of independent asset links',()=>{
 const r=makeEngine(sampleDataset(),'NVDA').analyze(470,499,['correlation','riemannian']);assert.equal(r.models[0].representation.shrinkage.linear,1);assert.equal(r.models[0].evidence.code,'insufficient');assert.equal(r.models[1].evidence.code,'limited');
});
test('adjacent comparisons require an entire immediately prior equal-length window',()=>{
 const e=makeEngine(sampleDataset(),'NVDA'),a=e.analyze(0,29,['wasserstein','riemannian']);assert.equal(a.previousPeriod,null);assert.ok(a.models.every(m=>m.change===null));const b=e.analyze(30,59,['wasserstein','riemannian']);assert.equal(b.previousPeriod.from,e.rows[0].date);assert.equal(b.previousPeriod.to,e.rows[29].date);assert.ok(b.models.every(m=>m.change!==null));
});
test('distribution preserves raw extreme observations and reports fractional tail mass',()=>{
 const ds={NVDA:fixture([100,100,100,100,100,100,100,100,100,50])},m=makeEngine(ds,'NVDA').analyze(0,9,['wasserstein']).models[0];nearly(m.tailMass,1.8);nearly(m.plot.values[0],-50);assert.equal(m.evidence.code,'limited');
});
test('multiscale state uses context through the endpoint, with incomplete scales marked',()=>{
 const e=makeEngine(sampleDataset(),'NVDA');const a=e.analyze(0,29,['ultrametric']).models[0];assert.equal(a.scales.filter(s=>s.available).length,1);assert.equal(a.evidence.code,'insufficient');const b=e.analyze(100,129,['ultrametric']).models[0];assert.equal(b.scales.filter(s=>s.available).length,3);assert.equal(b.contextBars,130);assert.equal(b.derived,true);
});
test('missing volume limits order evidence and cannot manufacture an event date',()=>{
 const ds=sampleDataset();ds.NVDA=ds.NVDA.map(r=>({...r,volume:0}));const m=makeEngine(ds,'NVDA').analyze(470,499,['signature']).models[0];assert.equal(m.evidence.code,'limited');assert.equal(m.metrics[0].value,null);assert.ok(m.signature.vector.every(Number.isFinite));
});
test('joint block sampling retains aligned dates, asset count and deterministic outputs',()=>{
 const ds=sampleDataset(),b=Object.values(ds).map(rows=>rows.slice(0,30)),a=resampleBasket(b,24);assert.deepEqual(a,resampleBasket(b,24));assert.equal(a.length,8);assert.ok(a.every(s=>s.length===30));assert.deepEqual(a[0].map(r=>r.date),b[0].map(r=>r.date));
});
test('only Homology exposes historical retrieval and each horizon has its own mature cohort',()=>{
 const e=makeEngine(sampleDataset(),'NVDA'),r=e.homology(470,499);assert.throws(()=>e.find(470,499,['dtw']));assert.equal(r.consensus,undefined);assert.deepEqual(r.cohorts.map(c=>c.h),[5,20,60]);assert.ok(r.cohorts[0].eligibleCount>r.cohorts[2].eligibleCount);
 for(const c of r.cohorts){assert.ok(c.matches.every(m=>m.end+c.h<r.start));for(let i=0;i<c.matches.length;i++)for(let j=i+1;j<c.matches.length;j++)assert.ok(Math.abs(c.matches[i].end-c.matches[j].end)>=r.length+c.h);assert.equal(c.outcome.n,c.matches.length);assert.ok(c.matches.every(m=>!('votes'in m)));}
});
test('missing and flat baskets explain why Homology is unavailable',()=>{
 const rows=fixture(Array(60).fill(100));const a=makeEngine({NVDA:rows},'NVDA').homology(30,59);assert.equal(a.evidence.code,'insufficient');assert.equal(a.cohorts.length,0);const b=makeEngine({NVDA:rows,AAPL:rows,MSFT:rows},'NVDA').homology(30,59);assert.equal(b.evidence.code,'insufficient');assert.match(b.evidence.en,/variation/);
});
test('short prior history supports 5D retrieval even when 60D has no eligible candidates',()=>{
 const e=makeEngine(sampleDataset(),'NVDA'),r=e.homology(60,89);assert.ok(r.cohorts[0].eligibleCount>0);assert.equal(r.cohorts[2].eligibleCount,0);assert.equal(r.cohorts[2].outcome.n,0);assert.equal(r.cohorts[2].outcome.mean,null);assert.equal(r.cohorts[2].evidence.code,'insufficient');
});
test('per-model evidence does not require history or votes',()=>{
 const a=makeEngine(sampleDataset(),'NVDA').analyze(0,29,['dtw']);const g={id:'dtw'};assert.equal(geometryEvidence(g,a).code,'observed');assert.equal(geometryEvidence({id:'signature'},a).code,'not-run');
});
test('selection and task validation reject bad arguments and deduplicate current model IDs',()=>{
 const e=makeEngine(sampleDataset(),'NVDA');assert.throws(()=>e.analyze(0,8));assert.throws(()=>e.analyze(0,120));assert.throws(()=>e.analyze(0,29,['topology']));assert.throws(()=>e.homology(0,29,0));assert.throws(()=>e.homology(0,29,8,{horizons:[7]}));assert.equal(e.analyze(0,29,['dtw','dtw']).models.length,1);
});
test('Homology validation reports attempted, excluded and scored origins separately',async()=>{
 const ds=sampleDataset(),e=makeEngine({NVDA:ds.NVDA},'NVDA'),r=await validateHomology(e);assert.equal(r.n,0);assert.equal(r.attempted,r.excluded);assert.equal(r.mae,null);assert.equal(r.evidence.code,'limited');
});

test('constant positive volume does not become a first volume event',()=>{
 const ds=sampleDataset();ds.NVDA=ds.NVDA.map(r=>({...r,volume:100}));const m=makeEngine(ds,'NVDA').analyze(470,499,['signature']).models[0];assert.equal(m.metrics[0].value,null);assert.match(m.summary[0],/constant/);
});
