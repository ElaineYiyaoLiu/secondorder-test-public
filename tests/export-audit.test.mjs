import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').split('\n').find(s=>s.startsWith("$('export').onclick="));
function setup(){const nodes=new Map(),calls=[],messages=[];const $=id=>{if(!nodes.has(id))nodes.set(id,{id,parentElement:{id:'analogues'},closest(){return this;}});return nodes.get(id);};const c=vm.createContext({$,document:{querySelector:()=>null},symbol:'NVDA',lang:'zh',rows:[{date:'2024-01-01'},{date:'2024-01-02'}],start:0,end:1,analysis:{models:[]},result:null,t:(en,zh)=>zh,exportPdf:async options=>calls.push(options),message:text=>messages.push(text),setButtons:()=>{$('export').disabled=false;}});vm.runInContext(source,c);return {$,c,calls,messages};}
test('PDF export receives current dates, language, structure and all result views',async()=>{const {$,calls}=setup();await $('export').onclick();assert.equal(calls.length,1);assert.equal(calls[0].lang,'zh');assert.equal(calls[0].filename,'secondorder-test-NVDA.pdf');assert.match(calls[0].title,/2024-01-01 \/ 2024-01-02/);assert.ok(calls[0].elements.some(e=>e?.id==='research-structure'));assert.ok(calls[0].elements.some(e=>e?.id==='lab-view'));assert.equal($('export').disabled,false);});
test('PDF failure is shown and export remains retryable',async()=>{const {$,c,messages}=setup();c.exportPdf=async()=>{throw Error('library failed');};await $('export').onclick();assert.match(messages[0],/PDF/);assert.equal($('export').disabled,false);});
test('Empty workspace does not create a PDF',async()=>{const {$,c,calls}=setup();c.analysis=null;await $('export').onclick();assert.equal(calls.length,0);});
