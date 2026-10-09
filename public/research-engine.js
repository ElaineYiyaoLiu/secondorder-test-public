import {makeEngine} from './engine.js';
import {diagramW2} from './topology.js';
export const RESEARCH_WINDOWS=[20,60,120];
export function persistenceSummary(diagram,previous=null,prior=null){
 const lives=diagram.map(([b,d])=>d-b),total=lives.reduce((s,x)=>s+x,0),energy=lives.reduce((s,x)=>s+x*x,0),velocity=previous?diagramW2(diagram,previous):null;
 return {count:lives.length,energy,total,maximum:Math.max(0,...lives),entropy:total?-lives.reduce((s,x)=>s+x/total*Math.log(x/total),0):0,velocity,acceleration:velocity!==null&&prior?.velocity!==null&&prior?.velocity!==undefined?velocity-prior.velocity:null};
}
export function researchStructure({dataset,symbol,start,end}){
 const engine=makeEngine(dataset,symbol),selected=engine.topology(start,end),timeline=[],prior={};
 // Identical trailing price-window convention and robust geometry as historical retrieval.
 for(let e=19;e<=end;e++){
  const scales={};
  for(const w of RESEARCH_WINDOWS){
   if(e<w-1)continue;
   const snapshot=engine.topology(e-w+1,e);
   if(!snapshot?.available){delete prior[w];scales[w]={available:false};continue;}
   const channels={};
   for(const channel of ['linear','rank'])channels[channel]=snapshot[channel].map((d,k)=>persistenceSummary(d,prior[w]?.snapshot[channel][k],prior[w]?.channels[channel][k]));
   scales[w]={available:true,channels,clippedReturns:snapshot.clippedReturns};prior[w]={snapshot,channels};
  }
  timeline.push({date:engine.rows[e].date,scales});
 }
 return {selected,timeline,windows:RESEARCH_WINDOWS,from:engine.rows[start].date,to:engine.rows[end].date,length:end-start+1,symbol,assets:engine.symbols,convention:'20/60/120 completed prices; 19/59/119 returns',geometry:'Robust Pearson and tied-rank Spearman, without identity shrinkage; F2 VR; L-infinity-ground W2'};
}
