// Window-local close-path geometry. Fixed design constants, no outcome fitting.
export const PATH_MODEL='price-path-dtw-v2';
export const PATH_CONFIG=Object.freeze({bandFraction:.1,maxRun:2,levelWeight:.65,slopeWeight:.35,timePenalty:.05,warpPenalty:.05,alignmentWeight:.70,endpointWeight:.15,regimeWeight:.15,scaleFloor:1e-6});
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function pathEmbedding(rows){
 if(!Array.isArray(rows)||rows.length<10||rows.length>120||Array.from(rows).some(r=>!r||!Number.isFinite(r.close)||r.close<=0))throw Error('Price path requires 10–120 finite positive closes.');
 const logs=rows.map(r=>Math.log(r.close)),returns=logs.slice(1).map((x,i)=>x-logs[i]);
 const realized=Math.hypot(...returns)/Math.sqrt(returns.length),center=avg(returns),volatility=Math.hypot(...returns.map(x=>x-center))/Math.sqrt(returns.length);
 const sorted=returns.map(Math.abs).sort((a,b)=>a-b),m=Math.floor(sorted.length/2);
 const median=sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;
 const scale=Math.max(PATH_CONFIG.scaleFloor,median/.6744897501960817),n=rows.length;
 const level=logs.map(x=>Math.asinh((x-logs[0])/(scale*Math.sqrt(n-1))));
 const slope=[0,...returns.map(x=>Math.asinh(x/scale))];
 const endpoint=[level.at(-1),Math.asinh((logs.at(-1)-logs[0])/.01)];
 const regime=[Math.log1p(realized/PATH_CONFIG.scaleFloor),Math.log1p(volatility/PATH_CONFIG.scaleFloor)];
 return {model:PATH_MODEL,n,level,slope,endpoint,regime,scale,realized,volatility};
}
function validate(a,b){
 for(const x of [a,b])if(!x||x.model!==PATH_MODEL||!Number.isInteger(x.n)||x.n<10||x.n>120||['level','slope','endpoint','regime'].some(k=>!Array.isArray(x[k])||x[k].length!=(k==='level'||k==='slope'?x.n:2)||Array.from(x[k]).some(v=>!Number.isFinite(v)||Math.abs(v)>1e6)))throw Error('Invalid price-path representation.');
 if(a.n!==b.n)throw Error('Price paths must have equal session counts.');
}
// Each diagonal consumes two observations; each horizontal/vertical consumes one.
// All endpoint-anchored paths therefore have weight 2*n. We minimize that same
// objective, rather than minimizing sum then dividing by the selected path length.
export function pathComparison(a,b,{trace=false,ablation=null}={}){
 validate(a,b);
 if(![null,'no-warp','no-slope','no-regime'].includes(ablation))throw Error('Unknown path ablation.');
 const c=PATH_CONFIG,n=a.n,band=ablation==='no-warp'?0:Math.ceil(n*c.bandFraction),size=n*n*5;
 const costs=new Float64Array(size);costs.fill(Infinity);
 const parents=trace?new Int8Array(size).fill(-1):null;
 const idx=(i,j,s)=>(i*n+j)*5+s;
 const local=(i,j)=>{
  const level=(a.level[i]-b.level[j])**2,slope=(a.slope[i]-b.slope[j])**2;
  return (ablation==='no-slope'?level:c.levelWeight*level+c.slopeWeight*slope)+(band?c.timePenalty*((i-j)/band)**2:0);
 };
 const put=(i,j,s,pi,pj,allowed,factor,penalty)=>{
  let best=Infinity,chosen=-1;
  for(const p of allowed){const value=costs[idx(pi,pj,p)];if(value<best){best=value;chosen=p;}}
  if(chosen>=0){costs[idx(i,j,s)]=best+factor*local(i,j)+penalty;if(parents)parents[idx(i,j,s)]=chosen;}
 };
 costs[0]=2*local(0,0);
 for(let i=0;i<n;i++)for(let j=Math.max(0,i-band);j<=Math.min(n-1,i+band);j++){
  if(!i&&!j)continue;
  if(i&&j)put(i,j,0,i-1,j-1,[0,1,2,3,4],2,0);
  if(j){put(i,j,1,i,j-1,[0],1,c.warpPenalty);put(i,j,2,i,j-1,[1],1,c.warpPenalty);}
  if(i){put(i,j,3,i-1,j,[0],1,c.warpPenalty);put(i,j,4,i-1,j,[3],1,c.warpPenalty);}
 }
 let state=0;for(let s=1;s<5;s++)if(costs[idx(n-1,n-1,s)]<costs[idx(n-1,n-1,state)])state=s;
 const alignment=costs[idx(n-1,n-1,state)]/(2*n);
 const endpoint=avg(a.endpoint.map((x,i)=>(x-b.endpoint[i])**2));
 const regime=ablation==='no-regime'?0:avg(a.regime.map((x,i)=>(x-b.regime[i])**2));
 const squared={alignment:c.alignmentWeight*alignment,endpoint:c.endpointWeight*endpoint,regime:c.regimeWeight*regime};
 const result={model:PATH_MODEL,distance:Math.sqrt(Object.values(squared).reduce((s,x)=>s+x,0)),squared,band};
 if(trace){
  let i=n-1,j=n-1;const path=[];
  while(true){path.push([i,j]);if(!i&&!j)break;const p=parents[idx(i,j,state)];if(p<0)throw Error('Unreachable alignment.');if(state===0){i--;j--;}else if(state<=2)j--;else i--;state=p;}
  result.path=path.reverse();result.warpSteps=result.path.slice(1).filter(([i,j],k)=>i===result.path[k][0]||j===result.path[k][1]).length;
 }
 return result;
}
export const pathDistance=(a,b)=>pathComparison(a,b).distance;
