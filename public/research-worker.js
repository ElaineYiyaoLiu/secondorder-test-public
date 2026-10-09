import {researchStructure} from './research-engine.js';
self.onmessage=({data})=>{try{self.postMessage({result:researchStructure(data)});}catch(error){self.postMessage({error:error.message});}};
