import test from 'node:test';
import assert from 'node:assert/strict';
import {geometryEvidence} from '../public/legacy-evidence.js';
import {GEOMETRIES,makeEngine} from '../public/legacy-engine.js';
import {sampleDataset} from '../public/data.js';
function search(g,n=3){const target=Object.fromEntries(GEOMETRIES.map(m=>[m.id,{}]));Object.assign(target,{relationship:{available:true},relationshipInformative:true,marketState:{available:true,shrinkage:.5},topologyState:{available:true}});return {active:[g.id],skipped:[],target,length:30,rankings:{[g.id]:Array.from({length:n},()=>({}))},methodCandidateCount:{[g.id]:10},methodEvidence:{[g.id]:{indistinguishable:false}}};}
for(const g of GEOMETRIES){
 test(g.id+' explains no history, few references and tied distances concisely',()=>{
  assert.equal(geometryEvidence(g,null,8).code,'not-run');
  const no=search(g,0);no.methodCandidateCount[g.id]=0;assert.equal(geometryEvidence(g,no,8).code,'history');
  const few=geometryEvidence(g,search(g,1),8);assert.equal(few.code,'few');assert.equal(few.showMatches,true);assert.ok(few.detailZh.length<60);
  const ties=search(g);ties.methodEvidence[g.id].indistinguishable=true;const tied=geometryEvidence(g,ties,8);assert.equal(tied.code,'ties');assert.equal(tied.showMatches,false);
  assert.equal(geometryEvidence(g,search(g),8).code,'calculated');
  if(g.basket)assert.equal(geometryEvidence(g,search(g),1).code,'basket');
 });
}
test('fully shrunk relationships explain current-data unsuitability without promising a longer window',()=>{const g=GEOMETRIES.find(g=>g.id==='correlation'),r=search(g);r.target.relationshipInformative=false;r.active=[];r.skipped=['correlation'];const status=geometryEvidence(g,r,8);assert.equal(status.code,'unsuitable');assert.equal(status.showMatches,false);assert.ok(!status.detailZh.includes('60'));assert.ok(status.detailZh.includes('其他模型'));});
test('undefined correlations, covariance and topology each explain insufficient variation',()=>{for(const id of ['correlation','riemannian','topology']){const g=GEOMETRIES.find(g=>g.id===id),r=search(g);r.target[id]=null;r.target[id==='correlation'?'relationship':id==='riemannian'?'marketState':'topologyState'].available=false;assert.equal(geometryEvidence(g,r,8).code,'variation');}});
test('spherical covariance and missing volume are limited evidence, not full relationship information',()=>{const g=GEOMETRIES.find(g=>g.id==='riemannian'),r=search(g);r.target.marketState.shrinkage=1;assert.equal(geometryEvidence(g,r,8).code,'structure');for(const id of ['euclidean','ultrametric','signature']){const g=GEOMETRIES.find(g=>g.id===id),r=search(g);if(id==='euclidean')r.target.candle={zeroVolumeCount:30};else r.target[id].summary={zeroVolumeCount:30};assert.equal(geometryEvidence(g,r,8).code,'volume');}});
test('flat repeated histories produce no fabricated rankings or votes across the eight models',()=>{const data=sampleDataset();for(const rows of Object.values(data))for(const r of rows)Object.assign(r,{open:100,high:100,low:100,close:100,volume:1000});const r=makeEngine(data,'NVDA').find(470,499,GEOMETRIES.map(g=>g.id));assert.deepEqual(r.active,[]);assert.deepEqual(r.analogues,[]);for(const g of GEOMETRIES){const status=geometryEvidence(g,r,8);assert.ok(['variation','ties'].includes(status.code),g.id+': '+status.code);assert.equal(status.showMatches,false);}});

