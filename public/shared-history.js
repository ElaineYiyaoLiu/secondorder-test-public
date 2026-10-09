// Browser-only handoff. This module never calls the market provider.
export const CHANNEL='secondorder-stock-history-v1';
const DB='secondorder-stock-history-v1';
export function historyDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('history');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function readSharedHistory(){const db=await historyDB();try{return await new Promise((resolve,reject)=>{const req=db.transaction('history').objectStore('history').get('latest');req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error);});}finally{db.close();}}
let writes=Promise.resolve();
export function publishSharedHistory(dataset,symbol,provider){
 const payload={type:CHANNEL,version:1,dataset:structuredClone(dataset),symbol,source:'marketstack',adjustment:provider.adjustment,asOf:provider.asOf,requestedYears:provider.requestedYears,receivedAt:Date.now()};
 writes=writes.catch(()=>{}).then(async()=>{try{const db=await historyDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction('history','readwrite');tx.objectStore('history').put(payload,'latest');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}finally{if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel(CHANNEL);channel.postMessage(payload);channel.close();}}});
 return writes;
}
