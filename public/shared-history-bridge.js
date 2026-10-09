import {CHANNEL,readSharedHistory} from './shared-history.js';
const allowed=new Set(['https://homology.secondorder.tools','https://secondorder-homology-public.vercel.app','https://secondorder.tools','https://www.secondorder.tools']);
const query=new URLSearchParams(location.search),origin=query.get('origin'),token=query.get('token');
const target=window.opener||(window.parent!==window?window.parent:null);
const status=document.getElementById('status');
if(allowed.has(origin)&&token&&target){
 let latest=null;
 const send=payload=>{if(payload&&(!latest||payload.receivedAt>=latest.receivedAt))latest=payload;target.postMessage({type:CHANNEL,token,payload:latest},origin);status.textContent=latest?'Connected. Latest completed session: '+latest.asOf+'. Updates arrive from Stock.':'No saved history yet. Open Stock and load market history, then keep both windows open.';};
 readSharedHistory().then(send).catch(()=>send(null));
 if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel(CHANNEL);channel.onmessage=e=>{if(e.data?.type===CHANNEL&&e.data.source==='marketstack')send(e.data);};}
 window.addEventListener('message',e=>{if(e.origin===origin&&e.source===target&&e.data?.type===CHANNEL&&e.data.token===token&&e.data.request==='latest')readSharedHistory().then(send).catch(()=>send(null));});
}else status.textContent='Open this connection from SecondOrder Homology.';
