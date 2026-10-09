import {signatureEmbedding,signatureDistance} from './path-signature.js';
import {hierarchyEmbedding,hierarchyDistance} from './hierarchy.js';
import {topologyEmbedding,topologyDistance} from './topology.js';
import {distributionEmbedding,distributionDistance} from './return-distribution.js';
import {marketEmbedding,marketDistance} from './market-state.js';
export {spdDistance} from './market-state.js';
import {relationEmbedding,relationDistance,relationHasEvidence} from './relationships.js';
import {pathEmbedding,pathDistance,pathComparison} from './price-path.js';
import {candleEmbedding,candleDistance,legacyCandle} from './candlestick.js';
// All representations use only their selected window. Outcome availability is
// checked before candidate construction, including in walk-forward evaluation.
export const GEOMETRIES=[
 {id:'euclidean',name:'Candlestick',zh:'K 线结构',family:'VALUE',math:'Weighted Euclidean',note:'Window-local candle shape, ordered price path, relative volume and volatility; fixed block weights.',cn:'分别比较窗口内的 K 线形态、有序价格路径、相对成交量和波动水平，使用固定分组权重。'},
 {id:'dtw',name:'Price path',zh:'价格路径',family:'PATH',math:'Regularized multichannel DTW',note:'Normalized close path and daily changes, bounded time warping, endpoint and volatility anchors.',cn:'比较归一化收盘价路径与每日变化，限制时间拉伸，并保留终点收益和波动水平。'},
 {id:'correlation',name:'Asset relationships',zh:'资产关系',family:'RELATION',math:'Robust shrinkage correlation',note:'Labelled asset pairs: winsorized linear correlation and tied-rank correlation, regularized toward independence.',cn:'比较同一组具名资产的稳健线性相关与并列排名相关，并向独立关系收缩。',basket:true},
 {id:'riemannian',name:'Market state',zh:'市场状态',family:'RELATION',math:'Normalized affine-invariant SPD',note:'Labelled robust covariance with adaptive spherical shrinkage; normalized affine-invariant SPD distance retains volatility.',cn:'对具名资产的稳健协方差做自适应球形收缩，用归一化黎曼距离比较风险水平和结构。',basket:true},
 {id:'wasserstein',name:'Return distribution',zh:'收益分布',family:'DISTRIBUTION',math:'Tail-weighted quantile transport',note:'Exact empirical quantile distances on smoothly compressed returns; fixed lower/upper tail weights retain risk and asymmetry.',cn:'对平滑压缩后的收益计算精确经验分位距离，固定加权上下尾部，保留风险与不对称性。'},
 {id:'topology',name:'Market structure',zh:'市场结构',family:'SHAPE',math:'Persistent diagrams · exact W₂',note:'Robust linear and rank Rips H₀/H₁; exact diagonal-aware diagram matching, with no identity shrinkage.',cn:'用稳健线性和排名距离计算 Rips H₀/H₁，并进行含对角线的精确持久图匹配，不加入独立性收缩。',basket:true},
 {id:'ultrametric',name:'Hierarchical state',zh:'层级状态',family:'HIERARCHY',math:'Multiresolution tree ultrametric',note:'Robust risk, trend, candle balance and volume states with neutral bands, explicit volume coverage and six refinement rounds. Same leaf does not imply identical windows.',cn:'稳健风险、趋势、K 线平衡和成交量状态，包含中性区间、成交量覆盖标记及六轮细分。同叶节点不代表窗口完全相同。'},
 {id:'signature',name:'Path order',zh:'路径顺序',family:'PATH',math:'Multiscale time-augmented log signature',note:'Time, compressed price, relative volume and zero-volume paths; step-2 order features across the whole window, halves and quarters, with activity anchors.',cn:'对交易日时间、压缩价格、相对成交量和零成交量路径计算整段、半段与四分段二阶顺序特征，并保留活动水平。'}
];
export const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
export const sd=a=>Math.sqrt(mean(a.map(x=>(x-mean(a))**2)));
export const rms=(a,b)=>Math.sqrt(mean(a.map((x,i)=>(x-b[i])**2)));
export const quantile=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),k=(s.length-1)*p,f=Math.floor(k);return s[f]+(s[Math.ceil(k)]-s[f])*(k-f);};
const returns=rows=>rows.slice(1).map((r,i)=>Math.log(r.close/rows[i].close));
export function dtw(a,b){
 const band=Math.max(Math.abs(a.length-b.length),Math.ceil(Math.max(a.length,b.length)*.1));
 let prev=Array(b.length+1).fill(Infinity);prev[0]=0;
 for(let i=1;i<=a.length;i++){const next=Array(b.length+1).fill(Infinity);for(let j=Math.max(1,i-band);j<=Math.min(b.length,i+band);j++)next[j]=(a[i-1]-b[j-1])**2+Math.min(prev[j],next[j-1],prev[j-1]);prev=next;}
 return Math.sqrt(prev[b.length]/(a.length+b.length));
}
const eye=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));
const mul=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((s,x,k)=>s+x*b[k][j],0)));
const transpose=a=>a[0].map((_,j)=>a.map(row=>row[j]));
export function eigen(matrix){
 const a=matrix.map(row=>[...row]),n=a.length,v=eye(n);
 for(let k=0;k<n*n*80;k++){
  let p=0,q=1,m=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(a[i][j])>m){m=Math.abs(a[i][j]);p=i;q=j;}
  if(m<1e-13)break;
  const theta=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(theta),s=Math.sin(theta),pp=a[p][p],qq=a[q][q],pq=a[p][q];
  for(let i=0;i<n;i++)if(i!==p&&i!==q){const ip=a[i][p],iq=a[i][q];a[i][p]=a[p][i]=c*ip-s*iq;a[i][q]=a[q][i]=s*ip+c*iq;}
  a[p][p]=c*c*pp-2*s*c*pq+s*s*qq;a[q][q]=s*s*pp+2*s*c*pq+c*c*qq;a[p][q]=a[q][p]=0;
  for(let i=0;i<n;i++){const ip=v[i][p],iq=v[i][q];v[i][p]=c*ip-s*iq;v[i][q]=s*ip+c*iq;}
 }
 return {values:a.map((r,i)=>r[i]),vectors:v};
}
function power(a,p){const {values,vectors}=eigen(a);return mul(vectors.map(row=>row.map((x,j)=>x*Math.max(1e-12,values[j])**p)),transpose(vectors));}
export function legacySpdDistance(a,b){const inv=power(a,-.5),c=mul(mul(inv,b),inv);return Math.sqrt(eigen(c).values.reduce((s,x)=>s+Math.log(Math.max(x,1e-12))**2,0));}
export function covariance(series){
 const centers=series.map(mean),n=series[0].length;
 return series.map((a,i)=>series.map((b,j)=>a.reduce((s,x,k)=>s+(x-centers[i])*(b[k]-centers[j]),0)/(n-1)));
}
export function correlation(cov){return cov.map((r,i)=>r.map((x,j)=>Math.max(-1,Math.min(1,x/Math.sqrt(Math.max(1e-20,cov[i][i]*cov[j][j]))))));}
// Exact Z2 column reduction of the Rips 2-skeleton. No proxy loops or H1 claims.
export function persistence(d){
 const n=d.length,simp=[];
 for(let i=0;i<n;i++)simp.push({v:[i],f:0});
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)simp.push({v:[i,j],f:d[i][j]});
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)for(let k=j+1;k<n;k++)simp.push({v:[i,j,k],f:Math.max(d[i][j],d[i][k],d[j][k])});
 simp.sort((a,b)=>a.f-b.f||a.v.length-b.v.length||a.v.join(',').localeCompare(b.v.join(',')));
 const index=new Map(simp.map((s,i)=>[s.v.join(','),i])),pivot=new Map(),reduced=[],pairs=[[],[]];
 for(let j=0;j<simp.length;j++){
  const s=simp[j];let col=new Set(s.v.length===1?[]:s.v.map((_,k)=>index.get(s.v.filter((_,i)=>i!==k).join(','))));
  while(col.size){const low=Math.max(...col);if(!pivot.has(low))break;for(const x of reduced[pivot.get(low)])col.has(x)?col.delete(x):col.add(x);}
  reduced[j]=col;
  if(col.size){const low=Math.max(...col);pivot.set(low,j);const dim=simp[low].v.length-1;if(dim<2&&s.f-simp[low].f>1e-9)pairs[dim].push([simp[low].f,s.f]);}
 }
 return pairs;
}
export function summary(diagrams){return diagrams.flatMap(d=>{const life=d.map(([b,e])=>e-b),total=life.reduce((s,x)=>s+x,0);return [d.length/10,total/10,Math.max(0,...life),Math.sqrt(mean(life.map(x=>x*x))),total?-life.reduce((s,x)=>s+(x/total)*Math.log(x/total),0):0];});}
export function signature(rows){
 let x=0,y=0,area=0;for(let i=1;i<rows.length;i++){const dx=Math.log(rows[i].close/rows[i-1].close),dy=Math.log((rows[i].volume+1)/(rows[i-1].volume+1))/10;area+=(x*dy-y*dx)/2;x+=dx;y+=dy;}
 return [x,y,area];
}
export function prefixDistance(a,b){if(!Array.isArray(a)||!Array.isArray(b)||!a.length||a.length!==b.length||[a,b].some(v=>Array.from(v).some(x=>!Number.isInteger(x)||x<0)))throw Error('Invalid equal-length prefixes.');let k=0;while(k<a.length&&a[k]===b[k])k++;return k===a.length?0:2**(-k);}
export function state(rows,basket=null,candleModel='v2',pathModel='v2',relationModel='v2',basketSymbols=null,relationAblation=null,marketModel='v2',marketAblation=null,distributionModel='v2',distributionAblation=null,topologyModel='v2',topologyAblation=null,hierarchyModel='v2',signatureModel='v2',signatureAblation=null){
 const r=returns(rows),v=mean(rows.map(c=>c.volume))||1,base=rows[0].close;
 const candle=candleModel==='legacy'?null:candleEmbedding(rows),feature=candle?candle.vector:legacyCandle(rows);
 const vol=sd(r),trend=mean(r),balance=mean(rows.map(c=>(c.close-c.open)/Math.max(c.high-c.low,1e-12))),volume=mean(rows.slice(Math.floor(rows.length/2)).map(c=>c.volume))/v;
 const result={euclidean:feature,dtw:pathModel==='legacy'?rows.map(c=>Math.log(c.close/base)):pathEmbedding(rows),wasserstein:distributionModel==='legacy'?r.sort((a,b)=>a-b):distributionEmbedding(rows,{ablation:distributionAblation}),ultrametric:hierarchyModel==='legacy'?[+(vol>.015),+(trend>0),+(balance>0),+(volume>1)]:hierarchyEmbedding(rows),signature:signatureModel==='legacy'?signature(rows):signatureEmbedding(rows,{ablation:signatureAblation})};
 if(candle)result.candle={model:candle.model,n:candle.n,scale:candle.scale,realized:candle.realized,zeroVolumeCount:candle.zeroVolumeCount};
 if(basket){const cov=covariance(basket.map(returns)),corr=correlation(cov);result.rawCorrelation=corr.flat();const relationship=relationModel==='legacy'?null:relationEmbedding(basket,basketSymbols||basket.map((_,i)=>`asset-${String(i).padStart(2,'0')}`),{ablation:relationAblation});result.relationship=relationship;result.relationshipInformative=relationHasEvidence(relationship);result.correlation=relationModel==='legacy'?corr.flat():relationship.available?relationship:null;const market=marketModel==='legacy'?null:marketEmbedding(basket,basketSymbols||basket.map((_,i)=>`asset-${String(i).padStart(2,'0')}`),{ablation:marketAblation});result.marketState=market;result.riemannian=marketModel==='legacy'?cov.map((row,i)=>row.map((x,j)=>i===j?x+1e-10:x*.9)):market.available?market:null;const d=corr.map((row,i)=>row.map((x,j)=>i===j?0:Math.sqrt(Math.max(0,2*(1-x)))));if(topologyModel==='legacy'){result.diagrams=persistence(d);result.topology=summary(result.diagrams);result.distance=d;}else{const shape=topologyEmbedding(basket,basketSymbols||basket.map((_,i)=>`asset-${String(i).padStart(2,'0')}`),{ablation:topologyAblation});result.topologyState=shape;result.topology=shape.available?shape:null;result.diagrams=shape.available?shape.linear:[[],[]];result.distance=shape.available?shape.linearDistances:null;}}
 return result;
}
export function distance(id,a,b){if(id==='euclidean')return candleDistance(a,b);if(id==='dtw')return pathDistance(a,b);if(id==='correlation')return relationDistance(a,b);if(id==='riemannian')return marketDistance(a,b);if(id==='topology')return topologyDistance(a,b);if(id==='ultrametric')return hierarchyDistance(a,b);if(id==='wasserstein')return distributionDistance(a,b);if(id==='signature')return signatureDistance(a,b);throw Error('Unknown geometry.');}
export function makeEngine(dataset,symbol,{candleModel='v2',pathModel='v2',pathAblation=null,relationModel='v2',relationAblation=null,relationEvidence='required',marketModel='v2',marketAblation=null,distributionModel='v2',distributionAblation=null,topologyModel='v2',topologyAblation=null,hierarchyModel='v2',signatureModel='v2',signatureAblation=null}={}){
 if(!['v2','legacy'].includes(signatureModel)||![null,'global-only','no-time'].includes(signatureAblation)||signatureModel==='legacy'&&signatureAblation!==null)throw Error('Invalid signature model.');
 if(!['v2','legacy'].includes(hierarchyModel))throw Error('Invalid hierarchy model.');
 if(!['v2','legacy'].includes(topologyModel)||![null,'linear-only','summary'].includes(topologyAblation)||topologyModel==='legacy'&&topologyAblation!==null)throw Error('Invalid topology model.');
 if(!['v2','legacy'].includes(distributionModel)||![null,'uniform','no-transform'].includes(distributionAblation)||distributionModel==='legacy'&&distributionAblation!==null)throw Error('Invalid distribution model.');
 if(!['v2','legacy'].includes(marketModel)||![null,'no-winsor','fixed-shrink'].includes(marketAblation)||marketModel==='legacy'&&marketAblation!==null)throw Error('Invalid market-state model.');
 if(![null,'no-warp','no-slope','no-regime'].includes(pathAblation)||pathModel==='legacy'&&pathAblation!==null)throw Error('Invalid path ablation.');
 if(!['v2','legacy'].includes(relationModel)||![null,'no-shrink','no-winsor','linear-only'].includes(relationAblation)||relationModel==='legacy'&&relationAblation!==null)throw Error('Invalid relationship model.');
 if(!['v2','legacy'].includes(pathModel))throw Error('Unknown price-path model.');
 if(!['v2','legacy'].includes(candleModel))throw Error('Unknown candle model.');
 if(!['required','legacy'].includes(relationEvidence))throw Error('Invalid relationship evidence rule.');
 if(!dataset||!Array.isArray(dataset[symbol]))throw Error('Unknown symbol.');
 const rows=dataset[symbol],symbols=Object.keys(dataset).sort();
 const basketPossible=symbols.length>=3&&symbols.length<=12&&symbols.every(s=>Array.isArray(dataset[s]));
 const cache=new Map();
 const get=(start,end)=>{const key=start+':'+end;if(!cache.has(key)){
  if(cache.size>3000)cache.clear();const window=rows.slice(start,end+1),basket=basketPossible?symbols.map(s=>dataset[s].slice(start,end+1)):null;
  const aligned=basket&&basket.every(series=>series.length===window.length&&Array.from(series).every((r,i)=>r&&typeof r.date==='string'&&r.date===window[i]?.date&&(!i||r.date>series[i-1]?.date)));
  cache.set(key,state(window,aligned?basket:null,candleModel,pathModel,relationModel,symbols,relationAblation,marketModel,marketAblation,distributionModel,distributionAblation,topologyModel,topologyAblation,hierarchyModel,signatureModel,signatureAblation));
 }return cache.get(key);};
 return {rows,symbols:basketPossible?symbols:[],get,
  find(start,end,ids,k=8,horizon=60){
   if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>=rows.length||end-start+1<10||end-start+1>120)throw Error('Select 10–120 sessions.');
   if(!Number.isInteger(k)||k<1||k>100||!Number.isInteger(horizon)||horizon<1||!Array.isArray(ids)||Array.from(ids).some(id=>!GEOMETRIES.some(g=>g.id===id)))throw Error('Invalid search options.');
   const usable=(id,repr)=>!!repr[id]&&(id!=='correlation'||relationModel==='legacy'||relationEvidence==='legacy'||repr.relationshipInformative);
   const target=get(start,end),length=end-start+1,active=[...new Set(ids)].filter(id=>usable(id,target)),candidates=[];
   for(let e=length-1;e+horizon<start;e+=5){const s=e-length+1,repr=get(s,e),scores={};for(const id of active)scores[id]=!usable(id,repr)?null:id==='signature'&&signatureModel==='legacy'?rms(target[id],repr[id]):id==='ultrametric'&&hierarchyModel==='legacy'?prefixDistance(target[id],repr[id]):id==='topology'&&topologyModel==='legacy'?rms(target[id],repr[id]):id==='wasserstein'&&distributionModel==='legacy'?mean(target[id].map((x,i)=>Math.abs(x-repr[id][i]))):id==='riemannian'&&marketModel==='legacy'?legacySpdDistance(target[id],repr[id]):id==='correlation'&&relationModel==='legacy'?rms(target[id],repr[id]):id==='euclidean'&&candleModel==='legacy'?rms(target[id],repr[id]):id==='dtw'&&pathModel==='legacy'?dtw(target[id],repr[id]):id==='dtw'&&pathAblation?pathComparison(target[id],repr[id],{ablation:pathAblation}).distance:distance(id,target[id],repr[id]);candidates.push({start:s,end:e,date:rows[e].date,scores});}
   const rankings={},methodCandidateCount={},methodEvidence={},unrankable=[],pool=new Map();
   for(const id of active){const eligible=candidates.filter(c=>Number.isFinite(c.scores[id]));methodCandidateCount[id]=eligible.length;const sorted=eligible.sort((a,b)=>a.scores[id]-b.scores[id]||a.end-b.end),chosen=[];const indistinguishable=eligible.length>1&&sorted[0].scores[id]===sorted.at(-1).scores[id];methodEvidence[id]={eligibleWindows:eligible.length,indistinguishable};if(indistinguishable&&relationEvidence!=='legacy'){rankings[id]=[];unrankable.push(id);continue;}for(let rank=0;rank<sorted.length;rank++){const c=sorted[rank];if(chosen.every(p=>Math.abs(p.end-c.end)>=length+horizon)){chosen.push({...c,rank:rank+1});const p=pool.get(c.end)||{...c,votes:[],rankSum:0};p.votes.push(id);p.rankSum+=rank+1;pool.set(c.end,p);}if(chosen.length===k)break;}rankings[id]=chosen;}
   const ordered=[...pool.values()].sort((a,b)=>b.votes.length-a.votes.length||a.rankSum/a.votes.length-b.rankSum/b.votes.length),consensus=[];
   for(const c of ordered){if(consensus.every(p=>Math.abs(p.end-c.end)>=length+horizon))consensus.push(c);if(consensus.length===k)break;}
   const effective=active.filter(id=>!unrankable.includes(id));
   return {start,end,length,active:effective,skipped:[...new Set(ids)].filter(id=>!effective.includes(id)),methodEvidence,rankings,analogues:consensus,candidateCount:candidates.length,methodCandidateCount,target,horizon};
  }
 };
}
export function outcomes(rows,candidates){return [5,20,60].map(h=>{const values=candidates.filter(c=>c.end+h<rows.length).map(c=>(rows[c.end+h].close/rows[c.end].close-1)*100);return {h,n:values.length,values,median:quantile(values,.5),mean:values.length?mean(values):null,positive:values.length?mean(values.map(x=>+(x>0)))*100:null,p10:quantile(values,.1),p90:quantile(values,.9)};});}
export async function tournament(engine,ids,onProgress=()=>{}){
 if(!Array.isArray(ids)||Array.from(ids).some(id=>!GEOMETRIES.some(g=>g.id===id)))throw Error('Invalid tournament methods.');
 ids=[...new Set(ids)];const enabled=new Set();
 const rows=engine.rows,length=30,h=20,records=Object.fromEntries(ids.map(id=>[id,[]]));let count=0;
 for(let end=260;end+h<rows.length;end+=20){
  const start=end-length+1,result=engine.find(start,end,ids,6,h),actual=(rows[end+h].close/rows[end].close-1)*100;
  for(const id of result.active)enabled.add(id);
  const baseline=[];for(let e=length-1;e+h<start;e+=length+h)baseline.push((rows[e+h].close/rows[e].close-1)*100);
  if(!baseline.length)continue;const base=mean(baseline);
  for(const id of result.active){const c=result.rankings[id];if(c.length<3)continue;const prediction=mean(c.map(p=>(rows[p.end+h].close/rows[p.end].close-1)*100));records[id].push({date:rows[end].date,actual,prediction,base,error:Math.abs(prediction-actual),baselineError:Math.abs(base-actual)});}
  count++;onProgress(count);await new Promise(r=>setTimeout(r,0));
 }
 const dates=[...enabled].map(id=>new Set(records[id].map(r=>r.date)));
 const common=new Set(dates.length?[...dates[0]].filter(date=>dates.every(s=>s.has(date))):[]);
 return ids.map(id=>{const paired=records[id].filter(r=>common.has(r.date));return {id,n:paired.length,availableOrigins:records[id].length,excludedOrigins:records[id].filter(r=>!common.has(r.date)).map(r=>r.date),mae:paired.length?mean(paired.map(x=>x.error)):null,baseline:paired.length?mean(paired.map(x=>x.baselineError)):null,records:paired};});
}

