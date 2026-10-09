import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEngine} from '../public/engine.js';
import {interactiveDataset} from '../public/data.js';
import {presentEvidence,geometryEvidence} from '../public/evidence.js';
const ds=interactiveDataset(),engine=makeEngine(ds,'NVDA');
test('healthy Signature has descriptive display across windows and separate causality limitation',()=>{
 for(const n of [10,20,30,60,120]){
  const a=engine.analyze(850-n,849,['signature']),e=geometryEvidence({id:'signature'},a);
  assert.equal(e.code,'limited');assert.equal(e.displayCode,'descriptive');assert.equal(e.detailEn,'');assert.match(e.methodEn,/do not establish causality/);assert.equal(e.actionEn,'');
 }
});
test('tail sample shortage changes with window but flat prices stay uninformative',()=>{
 const a=engine.analyze(820,849,['wasserstein']),b=engine.analyze(790,849,['wasserstein']);
 const ea=geometryEvidence({id:'wasserstein'},a),eb=geometryEvidence({id:'wasserstein'},b);
 assert.equal(ea.reason,'few-tails');assert.equal(ea.displayCode,'sample');assert.match(ea.actionEn,/60 sessions/);assert.equal(eb.displayCode,'descriptive');
 const flat={NVDA:ds.NVDA.map(r=>({...r,open:100,high:100,low:100,close:100,volume:100}))};
 const f=makeEngine(flat,'NVDA').analyze(790,849,['signature','wasserstein']);
 for(const m of f.models){const e=presentEvidence(m.evidence,{id:m.id});assert.equal(e.displayCode,'information');assert.doesNotMatch(e.actionEn,/60 sessions/);assert.notEqual(e.displayCode,'descriptive');}
});
test('missing earlier scales needs history, regardless of selected length',()=>{
 const a=engine.analyze(0,29,['ultrametric']),e=geometryEvidence({id:'ultrametric'},a);
 assert.equal(e.reason,'history-scales');assert.equal(e.displayCode,'data');assert.match(e.actionEn,/Changing selection length alone does not add history/);
});
test('instability, unchecked resampling and exploratory limitations remain distinct and codes unchanged',()=>{
 for(const [reason,displayCode] of [['unstable','unstable'],['boundary','unstable'],['resamples','unchecked'],['unchecked','unchecked'],['clipped','sensitive'],['few-references','sample'],['prior-dominated','information'],['missing-volume','data']]){
  const e=presentEvidence({code:'limited',reason,en:'Detail',zh:'原因'});assert.equal(e.displayCode,displayCode);assert.equal(e.code,'limited');assert.ok(e.actionEn);assert.ok(e.actionZh);
 }
 assert.match(presentEvidence({code:'limited',reason:'unstable',en:'x',zh:'x'}).actionEn,/do not guarantee/);
 assert.match(presentEvidence({code:'limited',reason:'few-references',en:'x',zh:'x'}).actionEn,/longer query can reduce/);
});
test('all current warnings and Homology horizon warnings carry explicit reasons through serialization',()=>{
 for(const n of [10,20,30,60,120]){
  const a=engine.analyze(850-n,849);for(const m of a.models)if(m.evidence.code!=='observed')assert.ok(m.evidence.reason,m.id);
 }
 const h=engine.homology(820,849);for(const c of h.cohorts){if(c.evidence.code!=='observed')assert.ok(c.evidence.reason);const e=presentEvidence(c.evidence);assert.equal(e.code,c.evidence.code);assert.deepEqual(presentEvidence(JSON.parse(JSON.stringify(c.evidence))),e);}
});
