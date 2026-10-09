import {makeEngine,tournament} from './legacy-engine.js';
self.onmessage=async({data})=>{
 try{const engine=makeEngine(data.dataset,data.symbol);if(data.task==='lab'){const result=await tournament(engine,data.ids,n=>self.postMessage({type:'progress',n}));self.postMessage({type:'lab',result});}else self.postMessage({type:'result',result:engine.find(data.start,data.end,data.ids,data.k)});}catch(e){self.postMessage({type:'error',message:e.message});}
};


