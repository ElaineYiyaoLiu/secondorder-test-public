import test from 'node:test';
import assert from 'node:assert/strict';
import {dtw,spdDistance,persistence,prefixDistance,signature,makeEngine,GEOMETRIES,outcomes,tournament} from '../public/legacy-engine.js';
import {sampleDataset,parseCSV} from '../public/data.js';
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
test('SPD distance matches diagonal formula, symmetry, and congruence invariance',()=>{
 const a=[[2,0],[0,3]],b=[[8,0],[0,12]];close(spdDistance(a,b),Math.sqrt(2)*Math.log(4));
 const c=[[2,.3],[.3,1]],d=[[3,-.2],[-.2,2]];close(spdDistance(c,d),spdDistance(d,c));close(spdDistance(c,c),0);
 const transform=m=>[[4*m[0][0]+2*m[0][1]+2*m[1][0]+m[1][1],2*m[0][1]+m[1][1]],[2*m[1][0]+m[1][1],m[1][1]]];close(spdDistance(c,d),spdDistance(transform(c),transform(d)));
});
test('Rips square has exactly one finite H1 loop with expected birth and death',()=>{
 const d=[[0,1,Math.SQRT2,1],[1,0,1,Math.SQRT2],[Math.SQRT2,1,0,1],[1,Math.SQRT2,1,0]],p=persistence(d);assert.equal(p[0].length,3);assert.equal(p[1].length,1);close(p[1][0][0],1);close(p[1][0][1],Math.SQRT2);
});
test('DTW identity and ultrametric strong triangle inequality',()=>{
 close(dtw([0,1,2],[0,1,2]),0);for(const a of [[0,0,0,0],[1,0,0,0]])for(const b of [[0,1,0,0],[1,1,0,0]])for(const c of [[0,1,1,0],[1,0,1,0]])assert.ok(prefixDistance(a,c)<=Math.max(prefixDistance(a,b),prefixDistance(b,c)));
});
test('Step-2 log signature distinguishes order through signed area',()=>{
 const row=(price,vol)=>({close:price,volume:vol-1}),a=signature([row(1,1),row(Math.E,1),row(Math.E,Math.E)]),b=signature([row(1,1),row(1,Math.E),row(Math.E,Math.E)]);close(a[0],b[0]);close(a[1],b[1]);close(a[2],-b[2]);assert.ok(a[2]>0);
});
test('Candidate windows and outcomes mature before query; analogue horizons do not overlap',()=>{
 const engine=makeEngine(sampleDataset(),'NVDA'),start=470,end=499,result=engine.find(start,end,GEOMETRIES.map(g=>g.id));assert.equal(result.active.length,7);assert.deepEqual(result.skipped,['correlation']);assert.ok(result.analogues.length>0);for(const c of result.analogues){assert.ok(c.end+60<start);assert.equal(c.end-c.start+1,30);assert.ok(Object.values(c.scores).every(Number.isFinite));}for(let i=0;i<result.analogues.length;i++)for(let j=i+1;j<result.analogues.length;j++)assert.ok(Math.abs(result.analogues[i].end-result.analogues[j].end)>=90);assert.equal(outcomes(engine.rows,result.analogues)[0].n,result.analogues.length);
});
test('Appending unseen future rows cannot change an earlier historical search',()=>{
 const ds=sampleDataset(),before=makeEngine(ds,'NVDA').find(400,429,['dtw','riemannian']);const altered=structuredClone(ds);for(const data of Object.values(altered))for(let i=430;i<data.length;i++){data[i].close*=2;data[i].volume*=4;}const after=makeEngine(altered,'NVDA').find(400,429,['dtw','riemannian']);assert.deepEqual(after.analogues,before.analogues);
});
test('Single symbol disables basket methods rather than adding synthetic assets',()=>{
 const ds=sampleDataset(),engine=makeEngine({NVDA:ds.NVDA},'NVDA'),r=engine.find(470,499,GEOMETRIES.map(g=>g.id));assert.equal(engine.symbols.length,0);assert.equal(r.active.length,5);
});
test('CSV accepts complete histories and rejects duplicate dates and invalid OHLC',()=>{
 const rows=sampleDataset().NVDA;const csv='symbol,date,open,high,low,close,volume\n'+rows.map(r=>['NVDA',r.date,r.open,r.high,r.low,r.close,r.volume].join(',')).join('\n');assert.equal(parseCSV(csv).NVDA.length,500);assert.throws(()=>parseCSV(csv+'\n'+csv.split('\n')[1]));assert.throws(()=>parseCSV(csv.replace(String(rows[0].low),'-1')));
});
test('Walk-forward predictions at an origin are unchanged by later observations',async()=>{
 const ds=sampleDataset(),one=await tournament(makeEngine(ds,'NVDA'),['dtw']);const changed=structuredClone(ds);for(const r of changed.NVDA.slice(310)){for(const field of ['open','high','low','close'])r[field]*=1.3;r.volume*=2;}const two=await tournament(makeEngine(changed,'NVDA'),['dtw']);assert.ok(one[0].n>0);assert.equal(one[0].records[0].prediction,two[0].records[0].prediction);assert.equal(one[0].records[0].base,two[0].records[0].base);
});


