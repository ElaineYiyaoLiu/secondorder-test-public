import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const line=prefix=>source.split('\n').find(s=>s.startsWith(prefix));
function sandbox(){
 const elements=new Map(),blobs=[],revoked=[];
 const $=id=>{if(!elements.has(id))elements.set(id,{hidden:true,clicks:0,click(){this.clicks++;},removeAttribute(k){delete this[k];}});return elements.get(id);};
 const c=vm.createContext({$,Blob,URL:{createObjectURL(blob){blobs.push(blob);return 'blob:fixture-'+blobs.length;},revokeObjectURL(url){revoked.push(url);}},exportUrl:null,symbol:'X',source:'sample',providerInfo:null,rows:[{date:'2024-01-01'},{date:'2024-01-02'}],start:0,end:1,analysis:{mode:'analysis',models:[{id:'euclidean',metrics:[{value:0}]}]},result:null,lab:null,datasetRevision:0,cancel(){},makeEngine(d,s){return {rows:d[s]};},render(){},researchExport(){return {geometry:'fixture'};},providerLoading:false,run(){}});
 vm.runInContext(line('function clearExport'),c);vm.runInContext(line("$('export').onclick="),c);
 return {c,$,blobs,revoked};
}
test('export: actual handler generates JSON and retains a retryable URL until the next export',async()=>{
 const {c,$,blobs,revoked}=sandbox();$('export').onclick();const p=JSON.parse(await blobs[0].text());assert.equal(p.version,'v0.1');assert.equal(p.provider,null);assert.deepEqual(p.query,{from:'2024-01-01',to:'2024-01-02'});assert.equal(p.analysis.models[0].metrics[0].value,0);assert.equal($('export-download').hidden,false);assert.equal($('export-link').clicks,1);assert.equal(revoked.length,0);$('export').onclick();assert.deepEqual(revoked,['blob:fixture-1']);assert.equal($('export-link').href,'blob:fixture-2');vm.runInContext('clearExport()',c);assert.equal($('export-download').hidden,true);assert.equal($('export-link').href,undefined);
});
test('export: dataset changes remove earlier provider provenance from CSV and synthetic snapshots',async()=>{
 const {c,$,blobs}=sandbox();vm.runInContext(line('function setDataset'),c);c.providerInfo={adjustment:'raw',requestedYears:3};vm.runInContext("setDataset({X:rows},'X','csv')",c);assert.equal(c.providerInfo,null);c.analysis={models:[]};$('export').onclick();const p=JSON.parse(await blobs[0].text());assert.equal(p.source,'csv');assert.equal(p.provider,null);
});
test('export: real provider metadata and Homology are preserved in generated JSON',async()=>{
 const {c,$,blobs}=sandbox();c.source='provider';c.providerInfo={adjustment:'raw',requestedYears:5};c.result={mode:'homology',cohorts:[]};$('export').onclick();const p=JSON.parse(await blobs[0].text());assert.deepEqual(p.provider,{adjustment:'raw',requestedYears:5,actualBars:2});assert.equal(p.homology.mode,'homology');
});
