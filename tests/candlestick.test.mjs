import test from 'node:test';
import assert from 'node:assert/strict';
import {candleEmbedding,candleDistance,candleContributions,legacyCandle,CANDLE_WEIGHTS} from '../public/candlestick.js';
import {makeEngine,tournament} from '../public/legacy-engine.js';
import {sampleDataset} from '../public/data.js';
const fixture=sampleDataset().NVDA.slice(0,30);
const vec=rows=>candleEmbedding(rows).vector;
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const scale=(rows,p=1,v=1)=>rows.map(r=>({...r,open:r.open*p,high:r.high*p,low:r.low*p,close:r.close*p,volume:r.volume*v}));
const flat=(n=30,v=0)=>Array.from({length:n},()=>({open:100,high:100,low:100,close:100,volume:v}));
test('price units and positive volume units do not change the embedding',()=>{
 for(const p of [1e-100,.001,10,1e100])for(const v of [1e-100,.01,1e100])near(candleDistance(vec(fixture),vec(scale(fixture,p,v))),0);
});
test('zero volume remains distinct from steady positive volume and unit invariant',()=>{
 const a=vec(flat()),b=vec(flat(30,1));assert.ok(candleDistance(a,b)>0);near(candleDistance(b,vec(flat(30,1e200))),0);
 const mixed=fixture.map((r,i)=>({...r,volume:i%3? r.volume:0}));near(candleDistance(vec(mixed),vec(scale(mixed,1,1e-20))),0);
 assert.equal(candleEmbedding(mixed).zeroVolumeCount,10);
});
test('flat, near-flat, extreme prices and extreme volumes stay finite',()=>{
 const extreme=flat().map((r,i)=>({...r,open:i%2?1e300:1e-300,close:i%2?1e-300:1e300,high:1e300,low:1e-300,volume:i%2?1e300:1e-300}));
 for(const rows of [flat(),flat(10,1),flat(120,0),flat().map(r=>({...r,high:100+1e-12})),extreme]){assert.ok(vec(rows).every(Number.isFinite));near(candleDistance(vec(rows),vec(rows)),0);}
});
test('shape preserves body direction, wicks, overnight gaps and order',()=>{
 const a=flat().map(r=>({...r,high:102,low:98}));
 for(const change of [r=>({...r,close:101}),r=>({...r,close:99}),r=>({...r,high:104}),r=>({...r,low:96}),r=>({...r,open:101})]){const b=structuredClone(a);b[10]=change(b[10]);assert.ok(candleDistance(vec(a),vec(b))>0);}
 assert.ok(candleDistance(vec(fixture),vec([...fixture].reverse()))>0);
});
test('normalizing shape does not erase volatility regime',()=>{
 const a=flat().map(r=>({...r,high:101,low:100/1.01})),b=flat().map(r=>({...r,high:110,low:100/1.1}));
 const c=candleContributions(vec(a),vec(b));near(c.squared.shape,0);near(c.squared.path,0);near(c.squared.volume,0);assert.ok(c.squared.regime>0);
});
test('isolated volume spike cannot re-center every other bar',()=>{
 const a=flat(30,100),b=structuredClone(a);b[15].volume=1e200;
 const av=vec(a),bv=vec(b);assert.equal(av.filter((x,i)=>Math.abs(x-bv[i])>1e-12).length,1);
 assert.ok(candleDistance(av,bv)>0); // monotone compression, no clipping to zero
});
test('weighted norm has independently known zero-volume distance and additive contributions',()=>{
 const a=vec(flat()),b=vec(flat(30,100));near(candleDistance(a,b),Math.sqrt(CANDLE_WEIGHTS.volume/2));
 const c=candleContributions(vec(fixture),b);near(Object.values(c.squared).reduce((s,x)=>s+x,0),c.distance**2);
});
test('invalid bars and incompatible vectors fail explicitly',()=>{
 for(const r of [{close:NaN},{volume:-1},{volume:Infinity},{low:0},{high:90},{open:0}]){const a=flat();a[5]={...a[5],...r};assert.throws(()=>vec(a));}
 for(const n of [0,9,121])assert.throws(()=>vec(flat(n)));
 assert.throws(()=>candleDistance(vec(flat(10)),vec(flat(11))));assert.throws(()=>candleDistance([NaN],[NaN]));
});
test('metric properties on 500 deterministic random window triples',()=>{
 let seed=731;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 const window=()=>{let p=100;return Array.from({length:30},()=>{const open=p*Math.exp((rand()-.5)*.1),close=open*Math.exp((rand()-.5)*.1);p=close;return {open,close,high:Math.max(open,close)*Math.exp(rand()*.03),low:Math.min(open,close)*Math.exp(-rand()*.03),volume:rand()<.1?0:Math.exp(rand()*20)};});};
 for(let i=0;i<500;i++){const a=vec(window()),b=vec(window()),c=vec(window()),ab=candleDistance(a,b);assert.ok(Number.isFinite(ab)&&ab>=0);near(ab,candleDistance(b,a));assert.ok(candleDistance(a,c)<=ab+candleDistance(b,c)+1e-12);}
});
test('future changes and appended rows cannot change candle neighbours or historical predictions',async()=>{
 const ds=sampleDataset(),before=makeEngine(ds,'NVDA').find(400,429,['euclidean']);
 const altered=structuredClone(ds);for(const s of Object.keys(altered)){const rows=altered[s];altered[s]=[...rows.slice(0,430),...scale(rows.slice(430),3,10),...scale(rows.slice(430),7,100).map((r,i)=>({...r,date:new Date(Date.parse(ds.NVDA.at(-1).date)+86400000*(i+1)).toISOString().slice(0,10)}))];}
 const after=makeEngine(altered,'NVDA').find(400,429,['euclidean']);assert.deepEqual(after,before);
 const one=await tournament(makeEngine(ds,'NVDA'),['euclidean']);const two=await tournament(makeEngine(altered,'NVDA'),['euclidean']);
 for(const r of one[0].records.filter(r=>r.date<=ds.NVDA[429].date)){const other=two[0].records.find(x=>x.date===r.date);near(other.prediction,r.prediction);near(other.base,r.base);}
});
test('search validates indices, horizon, count and IDs; duplicate IDs cannot inflate consensus',()=>{
 const e=makeEngine(sampleDataset(),'NVDA');for(const args of [[400.1,429,['euclidean']],[400,429,['euclidean'],0],[400,429,['euclidean'],8,-1],[400,429,['unknown']]])assert.throws(()=>e.find(...args));
 assert.deepEqual(e.find(400,429,['euclidean','euclidean']),e.find(400,429,['euclidean']));
});
test('legacy diagnostic reproduces v0.1 arithmetic exactly',()=>{
 const v=fixture.reduce((s,r)=>s+r.volume,0)/fixture.length,base=fixture[0].close;
 assert.deepEqual(legacyCandle(fixture),fixture.flatMap(r=>[Math.log(r.open/base),Math.log(r.high/base),Math.log(r.low/base),Math.log(r.close/base),Math.log((r.volume+1)/(v+1))/10]));
});

