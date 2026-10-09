import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleDataset} from '../public/data.js';
import {dataCoverage} from '../public/coverage.js';
import {GEOMETRIES,makeEngine} from '../public/engine.js';
import {readFileSync} from 'node:fs';
const demo=sampleDataset('NVDA',850);
test('Homology leads and supporting models remain available',()=>{
 assert.equal(GEOMETRIES.length,8);assert.equal(GEOMETRIES[7].id,'topology');
 assert.deepEqual(GEOMETRIES.filter(g=>g.historical).map(g=>g.id),['topology']);
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.ok(!html.includes('geometry-view'));assert.ok(!html.includes('data-view="geometry"'));
 assert.ok(html.indexOf('id="homology-card"')<html.indexOf('id="model-grid"'));assert.match(html,/data-pane-button="structure"/);
});
test('extended demo is bounded, aligned, finite and preserves original audit fixture',()=>{
 assert.equal(Object.keys(demo).length,8);const original=sampleDataset();
 for(const s of Object.keys(demo)){assert.equal(demo[s].length,850);assert.deepEqual(demo[s].slice(-500),original[s]);assert.deepEqual(demo[s].map(r=>r.date),demo.NVDA.map(r=>r.date));}
});
test('demo supports default and maximum window at every historical horizon',()=>{
 const e=makeEngine(demo,'NVDA');
 for(const length of [30,120]){
  const c=dataCoverage(demo,'NVDA',850-length,849);assert.equal(c.homology,true);assert.equal(c.required,4*length+180);
  assert.equal(e.analyze(850-length,849).models.length,7);
  const h=e.homology(850-length,849,8,{stability:false});
  assert.equal(h.cohorts.length,3);assert.ok(h.cohorts.every(c=>c.matches.length>=3));
  assert.ok(h.cohorts.every(c=>c.matches.every(m=>m.end+c.h<850-length)));
 }
});
test('coverage does not mistake single-asset history for all-model support',()=>{
 const c=dataCoverage({NVDA:demo.NVDA},'NVDA',820,849);
 assert.equal(c.current,true);assert.equal(c.basket,false);assert.equal(c.homology,false);
});
test('coverage isolates query end and checks missing aligned candles',()=>{
 const c=dataCoverage(demo,'NVDA',240,269);assert.equal(c.homology,false);assert.equal(c.aligned,270);
 const broken=structuredClone(demo);broken.AAPL[830].volume=null;
 assert.equal(dataCoverage(broken,'NVDA',820,849).basket,false);
 assert.equal(dataCoverage(broken,'NVDA',820,849).homology,false);
});
test('coverage rejects invalid selections and exact minimal boundary works',()=>{
 for(const [a,b] of [[-1,29],[0,8],[0,120],[820,850],[NaN,849]])assert.equal(dataCoverage(demo,'NVDA',a,b).validSelection,false);
 assert.equal(dataCoverage(demo,'NVDA',270,299).homology,true);
 assert.equal(dataCoverage(demo,'NVDA',269,298).homology,false);
});
test('one-click Worker returns eight model results and supports Homology-only selection',async()=>{
 const messages=[];globalThis.self={postMessage:m=>messages.push(structuredClone(m))};
 try{
  await import('../public/worker.js?onboarding');
  const data={dataset:demo,symbol:'NVDA',start:820,end:849,task:'all',ids:GEOMETRIES.map(g=>g.id),k:3};
  await self.onmessage({data});let m=messages.at(-1);assert.equal(m.type,'all');assert.equal(m.result.analysis.models.length,7);assert.equal(m.result.homology.mode,'homology');
  await self.onmessage({data:{...data,ids:['topology']}});m=messages.at(-1);assert.equal(m.result.analysis,null);assert.equal(m.result.homology.cohorts.length,3);
  await self.onmessage({data:{...data,ids:['unknown']}});assert.equal(messages.at(-1).type,'error');
 }finally{delete globalThis.self;}
});
