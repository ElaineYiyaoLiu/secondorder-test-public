import {relationEmbedding} from './relationships.js';
export const TOPOLOGY_MODEL='market-topology-v2';
export const TOPOLOGY_CONFIG=Object.freeze({linearWeight:.7,rankWeight:.3,h0Weight:.5,h1Weight:.5});
const variants=[null,'linear-only','summary'];
export function ripsPersistence(d){
 const n=d?.length;
 if(!Array.isArray(d)||n<1||n>12||Array.from(d).some((r,i)=>!Array.isArray(r)||r.length!==n||Array.from(r).some((x,j)=>!Number.isFinite(x)||x<0||x>2||Math.abs(x-d[j]?.[i])>1e-12)||r[i]!==0))throw Error('Rips distances must be dense, symmetric, zero-diagonal and in [0,2].');
 const simplices=[];
 for(let i=0;i<n;i++)simplices.push({v:[i],f:0});
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)simplices.push({v:[i,j],f:d[i][j]});
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)for(let k=j+1;k<n;k++)simplices.push({v:[i,j,k],f:Math.max(d[i][j],d[i][k],d[j][k])});
 simplices.sort((a,b)=>a.f-b.f||a.v.length-b.v.length||a.v.reduce((s,x,i)=>s||x-b.v[i],0));
 const index=new Map(simplices.map((s,i)=>[s.v.join(','),i])),pivot=new Map(),reduced=[],diagrams=[[],[]];
 for(let j=0;j<simplices.length;j++){
  const s=simplices[j],col=new Set(s.v.length===1?[]:s.v.map((_,k)=>index.get(s.v.filter((_,i)=>i!==k).join(','))));
  while(col.size){const low=Math.max(...col);if(!pivot.has(low))break;for(const x of reduced[pivot.get(low)])col.has(x)?col.delete(x):col.add(x);}
  reduced[j]=col;
  if(col.size){const low=Math.max(...col),birth=simplices[low];pivot.set(low,j);const dim=birth.v.length-1;if(dim<2&&s.f>birth.f)diagrams[dim].push([birth.f,s.f]);}
 }
 return diagrams.map(points=>points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
}
function diagram(a){
 if(!Array.isArray(a)||a.length>66||Array.from(a).some(p=>!Array.isArray(p)||p.length!==2||Array.from(p).some(x=>!Number.isFinite(x))||p[0]<0||p[1]>2||p[0]>p[1]))throw Error('Expected a finite persistence diagram in [0,2].');
 return a.filter(([b,d])=>d>b);
}
// Exact square assignment with explicit diagonal copies. L-infinity ground
// norm, Wasserstein order 2. Finite forbidden cost exceeds any deletion plan.
export function diagramW2(a,b){
 a=diagram(a);b=diagram(b);const n=a.length,m=b.length,size=n+m;if(!size)return 0;
 const forbidden=4*size+1,cost=Array.from({length:size},(_,i)=>Array.from({length:size},(_,j)=>{
  if(i<n&&j<m)return Math.max(Math.abs(a[i][0]-b[j][0]),Math.abs(a[i][1]-b[j][1]))**2;
  if(i<n)return j-m===i?((a[i][1]-a[i][0])/2)**2:forbidden;
  if(j<m)return i-n===j?((b[j][1]-b[j][0])/2)**2:forbidden;
  return 0;
 }));
 const u=Array(size+1).fill(0),v=Array(size+1).fill(0),p=Array(size+1).fill(0),way=Array(size+1).fill(0);
 for(let i=1;i<=size;i++){
  p[0]=i;let j0=0;const min=Array(size+1).fill(Infinity),used=Array(size+1).fill(false);
  do{
   used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
   for(let j=1;j<=size;j++)if(!used[j]){const cur=cost[i0-1][j-1]-u[i0]-v[j];if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}
   for(let j=0;j<=size;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;
   j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);
 }
 let total=0;for(let j=1;j<=size;j++)total+=cost[p[j]-1][j-1];return Math.sqrt(total);
}
export function diagramSummary(diagrams){
 return diagrams.flatMap(d=>{const life=d.map(([b,e])=>e-b),total=life.reduce((s,x)=>s+x,0);return [d.length/10,total/10,Math.max(0,...life),life.length?Math.hypot(...life)/Math.sqrt(life.length):0,total?-life.reduce((s,x)=>s+(x/total)*Math.log(x/total),0):0];});
}
export function topologyEmbedding(basket,symbols,{ablation=null}={}){
 if(!variants.includes(ablation))throw Error('Unknown topology variant.');
 // No identity shrinkage: a collapsed independence prior would manufacture
 // equidistant geometry. Short-window uncertainty is retained as a limitation.
 const r=relationEmbedding(basket,symbols,{ablation:'no-shrink'}),info={model:TOPOLOGY_MODEL,n:r.n,symbols:r.symbols,ablation,available:r.available,invalidAssets:r.invalidAssets,clippedReturns:r.clippedReturns};
 if(!r.available)return {...info,reason:'Insufficient return variation; topology is undefined.'};
 const convert=c=>c.map((row,i)=>row.map((x,j)=>i===j?0:Math.sqrt(Math.max(0,2*(1-x))))),linearDistances=convert(r.linear),rankDistances=convert(r.rank),linear=ripsPersistence(linearDistances),rank=ripsPersistence(rankDistances);
 return {...info,linear,rank,linearDistances,rankDistances,counts:{linear:linear.map(d=>d.length),rank:rank.map(d=>d.length)},essentialH0:1};
}
function validate(a){
 if(!a||a.model!==TOPOLOGY_MODEL||a.available!==true||!Number.isInteger(a.n)||a.n<10||a.n>120||!variants.includes(a.ablation)||!Array.isArray(a.symbols)||a.symbols.length<3||a.symbols.length>12||Array.from(a.symbols).some((s,i)=>typeof s!=='string'||!s.length||(i&&s<=a.symbols[i-1]))||!Array.isArray(a.linear)||a.linear.length!==2||!Array.isArray(a.rank)||a.rank.length!==2)throw Error('Invalid or unavailable topology representation.');
 for(const channel of [a.linear,a.rank])for(const d of channel)diagram(d);
}
export function topologyComparison(a,b){
 validate(a);validate(b);if(a.n!==b.n||a.symbols.length!==b.symbols.length||a.symbols.some((s,i)=>s!==b.symbols[i])||a.ablation!==b.ablation)throw Error('Topology requires the same labelled assets, length and variant.');
 const p=a.symbols.length,weights={linear:a.ablation==='linear-only'?1:TOPOLOGY_CONFIG.linearWeight,rank:a.ablation==='linear-only'?0:TOPOLOGY_CONFIG.rankWeight};
 if(a.ablation==='summary'){
  const dist=(x,y)=>Math.sqrt(diagramSummary(x).reduce((s,v,i)=>s+(v-diagramSummary(y)[i])**2,0)/10),linear=dist(a.linear,b.linear),rank=dist(a.rank,b.rank);
  return {distance:Math.sqrt(.7*linear**2+.3*rank**2),channels:{linear,rank}};
 }
 const channels={linear:a.linear.map((d,i)=>diagramW2(d,b.linear[i])/Math.sqrt(p)),rank:a.rank.map((d,i)=>diagramW2(d,b.rank[i])/Math.sqrt(p))};
 const squared={linear:weights.linear*(TOPOLOGY_CONFIG.h0Weight*channels.linear[0]**2+TOPOLOGY_CONFIG.h1Weight*channels.linear[1]**2),rank:weights.rank*(TOPOLOGY_CONFIG.h0Weight*channels.rank[0]**2+TOPOLOGY_CONFIG.h1Weight*channels.rank[1]**2)};
 return {distance:Math.sqrt(squared.linear+squared.rank),channels,squared};
}
export const topologyDistance=(a,b)=>topologyComparison(a,b).distance;
