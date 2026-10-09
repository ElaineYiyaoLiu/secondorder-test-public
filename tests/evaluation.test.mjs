import test from 'node:test';
import assert from 'node:assert/strict';
import {commonEvaluation} from '../scripts/paired-evaluation.mjs';
const record=(date,actual,prediction=0)=>({date,actual,prediction,base:1});
test('comparison uses common dates, preserves coverage and pairs reordered records correctly',()=>{
 const r=commonEvaluation({old:[record('a',2),record('b',100),record('c',4)],next:[record('c',4,3),record('a',2,1)],ablation:[record('a',2,2),record('c',4,4),record('d',100)]});
 assert.deepEqual(r.dates,['a','c']);assert.equal(r.n,2);assert.deepEqual(r.mae,{old:3,next:1,ablation:0});assert.equal(r.zeroMAE,3);assert.equal(r.unconditionalMAE,2);assert.deepEqual(r.coverage.old,{available:3,excluded:['b']});assert.deepEqual(r.coverage.ablation,{available:3,excluded:['d']});
});
test('comparison rejects missing pairs, duplicate dates and unequal actuals or baselines',()=>{
 for(const methods of [{},{a:[record('a',1)],b:[record('b',1)]},{a:[record('a',1),record('a',1)]},{a:[record('a',1)],b:[record('a',2)]},{a:[record('a',1)],b:[{...record('a',1),base:2}]},{a:[record('a',NaN)]}])assert.throws(()=>commonEvaluation(methods));
});
import {tournament} from '../public/legacy-engine.js';
test('browser Lab compares all enabled methods at common origins and removes duplicate IDs',async()=>{
 const rows=Array.from({length:321},(_,i)=>({date:String(i),close:100+i})),c=[{end:29},{end:79},{end:129}];
 const engine={rows,find(start,end,ids){return {active:ids,rankings:{dtw:end===280?c.slice(0,2):c,euclidean:end===260?c.slice(0,2):c}};}};
 const results=await tournament(engine,['dtw','euclidean','dtw']);assert.equal(results.length,2);
 for(const r of results){assert.equal(r.n,1);assert.equal(r.availableOrigins,2);assert.deepEqual(r.records.map(x=>x.date),['300']);assert.equal(r.excludedOrigins.length,1);}
 const [one]=await tournament(engine,['dtw']);assert.equal(one.n,2);assert.deepEqual(one.excludedOrigins,[]);
});
test('unavailable basket geometry does not remove single-symbol Lab origins',async()=>{
 const rows=Array.from({length:321},(_,i)=>({date:String(i),close:100+i})),engine={rows,find(){return {active:['dtw'],rankings:{dtw:[{end:29},{end:79},{end:129}]}};}};
 const r=await tournament(engine,['dtw','topology']);assert.equal(r[0].n,3);assert.equal(r[1].n,0);
 assert.deepEqual(r[0].excludedOrigins,[]);await assert.rejects(()=>tournament(engine,['unknown']));
});

