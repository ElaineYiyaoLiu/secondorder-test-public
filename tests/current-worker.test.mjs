import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleDataset} from '../public/data.js';
test('production Worker dispatches seven analyses, Homology and its Lab without legacy retrieval',async()=>{
 const messages=[];globalThis.self={postMessage:m=>messages.push(structuredClone(m))};
 try{await import('../public/worker.js');const data={dataset:sampleDataset(),symbol:'NVDA',start:470,end:499};
 await self.onmessage({data:{...data,task:'analysis'}});assert.equal(messages.at(-1).type,'analysis');assert.equal(messages.at(-1).result.models.length,7);assert.equal(messages.at(-1).result.rankings,undefined);
 await self.onmessage({data:{...data,task:'homology'}});assert.equal(messages.at(-1).type,'homology');assert.equal(messages.at(-1).result.cohorts.length,3);
 await self.onmessage({data:{...data,task:'lab',dataset:{NVDA:data.dataset.NVDA}}});assert.equal(messages.at(-1).type,'lab');assert.equal(messages.at(-1).result.id,'topology');
 await self.onmessage({data:{...data,task:'find'}});assert.equal(messages.at(-1).type,'error');
 }finally{delete globalThis.self;}
});
