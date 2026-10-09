import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {interactiveDataset,sampleDataset,BASKET,validateDataset} from '../public/data.js';
import {makeEngine} from '../public/engine.js';
const data=interactiveDataset();
test('interactive demo has bounded valid history and common plus asset-specific movement',()=>{
 assert.equal(Object.keys(validateDataset(data)).length,8);
 for(const s of BASKET){assert.equal(data[s].length,850);assert.deepEqual(data[s].map(r=>r.date),data.NVDA.map(r=>r.date));}
 assert.deepEqual(sampleDataset('NVDA',500),sampleDataset());
 assert.notDeepEqual(data.NVDA.map(r=>r.close),data.AAPL.map(r=>r.close));
 assert.deepEqual(data,interactiveDataset());
});
test('three rounds across eight assets and four windows produce 96 analyses with no missing metrics',()=>{
 for(const end of [849,789,729])for(const symbol of BASKET)for(const n of [20,30,60,120]){
  const r=makeEngine(data,symbol).analyze(end-n+1,end);
  assert.equal(r.models.length,7);
  for(const m of r.models){assert.notEqual(m.evidence.code,'insufficient',`${symbol} / ${end} / ${n} / ${m.id}`);assert.ok(m.metrics.length);for(const v of m.metrics)assert.ok(v.value!==null&&v.value!==undefined&&(!(typeof v.value==='number')||Number.isFinite(v.value)),`${symbol}/${end}/${n}/${m.id}/${v.en}`);}
 }
});
test('all eight assets have mature Homology outcomes on the default 30-day selection',()=>{
 for(const s of BASKET){const r=makeEngine(data,s).homology(820,849,8,{stability:false});assert.equal(r.cohorts.length,3);for(const c of r.cohorts){assert.ok(c.matches.length>=3);assert.ok(c.outcome.values.every(Number.isFinite));assert.ok(c.matches.every(m=>m.end+c.h<820));}}
});
test('genuinely insufficient data still explains insufficiency without invented values',()=>{
 const rows=data.NVDA.slice(-30),r=makeEngine({NVDA:rows},'NVDA').analyze(0,29);
 for(const id of ['correlation','riemannian']){const m=r.models.find(m=>m.id===id);assert.equal(m.evidence.code,'insufficient');assert.match(m.evidence.en,/3–12/);assert.equal(m.metrics.length,0);}
 const h=makeEngine({NVDA:rows},'NVDA').homology(0,29);assert.equal(h.evidence.code,'insufficient');
 const risk=makeEngine(data,'NVDA').analyze(0,29,['riemannian']).models[0];assert.equal(risk.comparisonAvailable,false);assert.ok(!risk.metrics.some(v=>v.en.includes('SPD')));
});
test('actual metric renderer gives specific reasons for undefined peaks, pairs and comparisons',()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),line=source.split('\n').find(s=>s.startsWith('function metricValue'));
 const c=vm.createContext({t:(en,zh)=>zh,escape:String});vm.runInContext(line,c);
 for(const [en,reason] of [['First maximum volume date','成交量无明显峰值'],['First highest close date','收盘价无变化'],['Strongest linear pair','无法区分有效关联'],['Adjacent-window SPD distance','无有效相邻区间']])assert.ok(c.metricValue({en,value:null}).includes(reason));
 assert.equal(c.metricValue({en:'Daily volatility',value:0,unit:'percent'}),'0.00%');
});
