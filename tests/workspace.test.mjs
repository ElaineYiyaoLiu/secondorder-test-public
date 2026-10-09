import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {interactiveDataset,validateDataset,instrument} from '../public/data.js';
import {makeEngine,GEOMETRIES,ANALYSIS_IDS,mean} from '../public/engine.js';
import {stocks,candleTranslation} from '../public/market.js';
import {dataCoverage} from '../public/coverage.js';
import {viewport,panViewport,zoomViewport} from '../public/chart-view.js';
import {geometryEvidence,presentEvidence} from '../public/evidence.js';
import {plainReading,homologyReading,candleContext} from '../public/plain-reading.js';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function workspace(){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{id,hidden:id==='data-workspace',dataset:{},value:id==='history-years'?'3':'',checked:id==='provider-basket',disabled:false,textContent:'',innerHTML:'',querySelectorAll:()=>[],setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},toggleAttribute(k,v){this[k]=v;},addEventListener(){},click(){this.onclick?.();}});return elements.get(id);};
 let resolve,reject,request;
 const pending=new Promise((a,b)=>{resolve=a;reject=b;});
 class Worker{terminate(){this.stopped=true;}postMessage(data){queueMicrotask(()=>{if(this.stopped)return;const e=makeEngine(data.dataset,data.symbol);this.onmessage?.({data:{type:'all',result:{analysis:e.analyze(data.start,data.end),homology:e.homology(data.start,data.end)}}});});}}
 const context=vm.createContext({Worker,researchContext(){},renderValidationPlots(){},researchExport(){return null;},document:{getElementById:get,querySelectorAll:()=>[],documentElement:{}},location:{search:'',href:'https://example.test/'},URL,URLSearchParams,stocks,candleTranslation,interactiveDataset,validateDataset,instrument,makeEngine,GEOMETRIES,ANALYSIS_IDS,mean,dataCoverage,viewport,panViewport,zoomViewport,geometryEvidence,presentEvidence,plainReading,homologyReading,candleContext,fetch:url=>{request=url;return pending;}});
 vm.runInContext(source,context);
 return {get,context,resolve,reject,get request(){return request;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('startup requests the real three-year basket and hides all synthetic values until success',async()=>{
 const w=workspace();assert.match(w.request,/symbol=NVDA&basket=1&years=3/);
 assert.equal(w.get('data-workspace').hidden,true);assert.equal(w.get('price').textContent,'');assert.equal(w.get('find').disabled,true);
 const dataset=interactiveDataset();w.resolve({ok:true,json:async()=>({source:'marketstack',dataset,adjustment:'all'})});await settle();
 assert.equal(w.get('data-workspace').hidden,false);assert.equal(w.get('find').disabled,false);assert.match(w.get('data-summary').textContent,/Marketstack/);assert.doesNotMatch(w.get('data-summary').textContent,/Synthetic/);assert.ok(w.get('price').textContent);
});
test('provider failure leaves the workspace empty and calculations disabled without demo fallback',async()=>{
 const w=workspace();w.resolve({ok:false,json:async()=>({code:'provider-quota',error:'quota'})});await settle();
 assert.equal(w.get('data-workspace').hidden,true);assert.equal(w.get('find').disabled,true);assert.equal(w.get('retry-data').disabled,false);assert.equal(w.get('retry-data').hidden,false);assert.match(w.get('message').textContent,/quota/);assert.equal(w.get('price').textContent,'');
});
test('an explicitly chosen demo cannot be overwritten by an in-flight real-data response or error',async()=>{
 for(const ok of [true,false]){
  const w=workspace();w.get('sample').click();assert.equal(w.get('data-workspace').hidden,false);assert.match(w.get('data-summary').textContent,/Synthetic/);
  w.resolve({ok,json:async()=>ok?{source:'marketstack',dataset:interactiveDataset(),adjustment:'all'}:{code:'provider-quota',error:'quota'}});await settle();
  assert.match(w.get('data-summary').textContent,/Synthetic/);assert.equal(w.get('message').textContent,'');assert.equal(w.get('find').disabled,false);
 }
});
test('both languages render support cards and dedicated validation follows the main views',async()=>{
 const w=workspace();w.resolve({ok:true,json:async()=>({source:'marketstack',dataset:interactiveDataset(),adjustment:'all'})});await settle();
 vm.runInContext("lang='zh'; render()",w.context);assert.match(w.get('data-summary').textContent,/已复权/);assert.equal((w.get('analysis-cards').innerHTML.match(/data-run-model=/g)||[]).length,7);
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/data-view=/);assert.doesNotMatch(html,/id="provider"/);assert.match(html,/<details class="data-options"/);assert.ok(html.indexOf('id="lab-view"')>html.indexOf('id="homology-card"'));assert.match(html,/data-pane="validation"/);
});
test('brief explanations preserve unavailable results and distinguish intraday bodies from daily change',()=>{
 const data=interactiveDataset(),models=makeEngine(data,'NVDA').analyze(820,849).models;
 for(const m of models)for(const lang of ['en','zh'])assert.ok(plainReading(m,lang).length>20);
 assert.equal(plainReading({...models[0],evidence:{code:'insufficient'}}),'');
 const text=candleContext({close:105,volume:200},{close:110},[{volume:100}],'zh');assert.match(text,/下跌 4.55%/);assert.match(text,/2.00 倍/);
 assert.match(homologyReading({matches:[{}],divergent:true},20,'zh'),/有些上涨，有些下跌/);
});
test('loading status stays in the selected language while the provider request is pending',()=>{
 const w=workspace();assert.match(w.get('data-summary').textContent,/about 6 seconds/);assert.doesNotMatch(w.get('message').textContent,/[\u3400-\u9fff]/);
 vm.runInContext("lang='zh';render()",w.context);assert.match(w.get('data-summary').textContent,/大约需要 6 秒/);
 vm.runInContext("lang='en';render()",w.context);assert.match(w.get('data-summary').textContent,/about 6 seconds/);assert.doesNotMatch(w.get('data-summary').textContent,/[\u3400-\u9fff]/);
});
test('Method opens before data loads, follows language, and returns to the preserved workspace',()=>{
 const w=workspace();w.get('open-method').click();assert.equal(w.get('workspace-view').hidden,true);assert.equal(w.get('method-view').hidden,false);assert.equal(w.get('method-frame').src,'/method.html?embedded=1&lang=en');
 vm.runInContext("lang='zh';render()",w.context);assert.equal(w.get('method-frame').src,'/method.html?embedded=1&lang=zh');
 w.get('close-method').click();assert.equal(w.get('workspace-view').hidden,false);assert.equal(w.get('method-view').hidden,true);assert.equal(w.get('data-workspace').hidden,true);
});
test('direct candle-chart dragging selects analysis dates without a timeline interaction',async()=>{
 const w=workspace();w.resolve({ok:true,json:async()=>({source:'marketstack',dataset:interactiveDataset(),adjustment:'all'})});await settle();
 const chart=w.get('candles');chart.focus=()=>{};chart.getBoundingClientRect=()=>({left:0,width:900});chart.setPointerCapture=()=>{};chart.hasPointerCapture=()=>false;
 chart.onpointerdown({button:0,pointerId:1,clientX:220,shiftKey:false});chart.onpointermove({pointerId:1,clientX:620});chart.onpointerup({pointerId:1});
 const bounds=vm.runInContext('({start,end,windowSize,offset})',w.context);assert.ok(bounds.end>bounds.start);assert.equal(w.get('from').value,bounds.start);assert.equal(w.get('to').value,bounds.end);assert.equal(bounds.windowSize,63);assert.equal(bounds.offset,0);
});
