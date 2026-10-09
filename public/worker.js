import {makeEngine,validateHomology} from './engine.js';
import {validateStudy} from './validation-study.js';
self.onmessage=async({data})=>{
 try{
  const engine=makeEngine(data.dataset,data.symbol);
  if(data.task==='all'){
   const ids=data.ids||[];
   const analysis=ids.some(id=>id!=='topology')?engine.analyze(data.start,data.end,ids.filter(id=>id!=='topology')):null;
   const homology=ids.includes('topology')?engine.homology(data.start,data.end,data.k):null;
   self.postMessage({type:'all',result:{analysis,homology}});
  }
  else if(data.task==='lab')self.postMessage({type:'lab',result:await validateStudy(engine,n=>self.postMessage({type:'progress',n}))});
  else if(data.task==='analysis')self.postMessage({type:'analysis',result:engine.analyze(data.start,data.end,data.ids)});
  else if(data.task==='homology')self.postMessage({type:'homology',result:engine.homology(data.start,data.end,data.k)});
  else throw Error('Unknown task.');
 }catch(e){self.postMessage({type:'error',message:e.message});}
};
