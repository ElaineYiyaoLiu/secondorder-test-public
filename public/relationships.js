// Fixed window-local relationship geometry. No outcome fitting or pairwise deletion.
export const RELATION_MODEL='asset-relationships-v2';
export const RELATION_CONFIG=Object.freeze({linearWeight:.7,rankWeight:.3,winsorLimit:4,scaleFloor:1e-6,varianceFloor:1e-12});
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const median=a=>{const s=[...a].sort((x,y)=>x-y),k=Math.floor(s.length/2);return s.length%2?s[k]:(s[k-1]+s[k])/2;};
export function averageRanks(values){
 if(!Array.isArray(values)||!values.length||Array.from(values).some(x=>!Number.isFinite(x)))throw Error('Ranks require finite observations.');
 const ordered=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v||a.i-b.i),ranks=Array(values.length);
 for(let start=0;start<ordered.length;){let end=start+1;while(end<ordered.length&&ordered[end].v===ordered[start].v)end++;const rank=(start+end-1)/2;for(let i=start;i<end;i++)ranks[ordered[i].i]=rank;start=end;}
 return ranks;
}
function standardized(values,floor){const center=mean(values),residuals=values.map(x=>x-center),scale=Math.hypot(...residuals)/Math.sqrt(values.length);return scale<=floor?null:residuals.map(x=>x/scale);}
// OAS in its original finite-p form, applied to an empirical unit-diagonal Gram
// matrix. After winsorization/ranking this is regularization, not an oracle claim.
export function oasCorrelation(matrix,samples,{shrink=true}={}){
 const p=matrix?.length;
 if(!Number.isInteger(p)||p<3||p>12||!Number.isInteger(samples)||samples<9||samples>119||Array.from(matrix).some((row,i)=>!Array.isArray(row)||row.length!==p||Array.from(row).some((x,j)=>!Number.isFinite(x)||Math.abs(x)>1+1e-10||Math.abs(x-matrix[j]?.[i])>1e-10)||Math.abs(row[i]-1)>1e-10))throw Error('Invalid unit-diagonal correlation matrix.');
 // Diagonal-pivoted Schur reduction avoids dividing by nearly zero pivots
 // in legitimate rank-deficient Gram matrices (e.g. 12 assets / 9 returns).
 const residual=matrix.map(row=>[...row]);
 for(let k=0;k<p;k++){
  let pivot=k;for(let i=k;i<p;i++){if(residual[i][i]<-1e-8)throw Error('Correlation matrix is not positive semidefinite.');if(residual[i][i]>residual[pivot][pivot])pivot=i;}
  if(residual[pivot][pivot]<=1e-10){for(let i=k;i<p;i++)for(let j=k;j<p;j++)if(Math.abs(residual[i][j])>1e-8)throw Error('Correlation matrix is not positive semidefinite.');break;}
  [residual[k],residual[pivot]]=[residual[pivot],residual[k]];for(const row of residual)[row[k],row[pivot]]=[row[pivot],row[k]];
  const d=residual[k][k];for(let i=k+1;i<p;i++)for(let j=k+1;j<p;j++)residual[i][j]-=residual[i][k]*residual[k][j]/d;
 }

 const tr2=matrix.reduce((s,row)=>s+row.reduce((t,x)=>t+x*x,0),0),den=(samples+1-2/p)*(tr2-p);
 const lambda=shrink?(den<=1e-12?1:Math.min(1,Math.max(0,((1-2/p)*tr2+p*p)/den))):0;
 return {shrinkage:lambda,matrix:matrix.map((row,i)=>row.map((x,j)=>i===j?1:lambda===1?0:(1-lambda)*x))};
}
function gram(series){const m=series[0].length;return series.map((a,i)=>series.map((b,j)=>i===j?1:Math.max(-1,Math.min(1,mean(a.map((x,k)=>x*b[k]))))));}
export function relationEmbedding(basket,symbols,{ablation=null}={}){
 if(![null,'no-shrink','no-winsor','linear-only'].includes(ablation))throw Error('Unknown relationship ablation.');
 if(!Array.isArray(basket)||basket.length<3||basket.length>12||!Array.isArray(symbols)||symbols.length!==basket.length||Array.from(symbols).some(s=>typeof s!=='string'||!s.length)||new Set(symbols).size!==symbols.length)throw Error('Provide 3–12 distinct labelled assets.');
 const n=basket[0]?.length;
 if(!Number.isInteger(n)||n<10||n>120||Array.from(basket).some(rows=>!Array.isArray(rows)||rows.length!==n||Array.from(rows).some((r,i)=>!r||typeof r.date!=='string'||!r.date.length||(i&&r.date<=rows[i-1]?.date)||r.date!==basket[0][i]?.date||!Number.isFinite(r.close)||r.close<=0)))throw Error('Relationship windows need aligned increasing dates and finite positive closes.');
 const order=symbols.map((s,i)=>({s,i})).sort((a,b)=>a.s<b.s?-1:a.s>b.s?1:0),names=order.map(x=>x.s),m=n-1,linear=[],rank=[],clipped=[],invalid=[];
 for(const {s,i} of order){
  const logs=basket[i].map(r=>Math.log(r.close)),returns=logs.slice(1).map((x,k)=>x-logs[k]);
  const center=median(returns),scale=Math.max(RELATION_CONFIG.scaleFloor,1.482602218505602*median(returns.map(x=>Math.abs(x-center))));
  const bounded=returns.map(x=>ablation==='no-winsor'?x:center+Math.max(-RELATION_CONFIG.winsorLimit*scale,Math.min(RELATION_CONFIG.winsorLimit*scale,x-center)));
  const a=standardized(bounded,RELATION_CONFIG.varianceFloor),b=standardized(averageRanks(returns),0);
  clipped.push(returns.filter(x=>Math.abs(x-center)>RELATION_CONFIG.winsorLimit*scale).length);
  if(!a||!b)invalid.push(s);linear.push(a);rank.push(b);
 }
 const info={model:RELATION_MODEL,n,symbols:names,available:!invalid.length,invalidAssets:invalid,clippedReturns:clipped,ablation};
 if(invalid.length)return {...info,reason:'Insufficient return variation; correlation is undefined.'};
 const a=oasCorrelation(gram(linear),m,{shrink:ablation!=='no-shrink'}),b=oasCorrelation(gram(rank),m,{shrink:ablation!=='no-shrink'}),edges=[];
 for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)edges.push([i,j]);
 const vector=[...edges.map(([i,j])=>a.matrix[i][j]*Math.sqrt((ablation==='linear-only'?1:RELATION_CONFIG.linearWeight)/edges.length)),...edges.map(([i,j])=>b.matrix[i][j]*Math.sqrt((ablation==='linear-only'?0:RELATION_CONFIG.rankWeight)/edges.length))];
 return {...info,linear:a.matrix,rank:b.matrix,shrinkage:{linear:a.shrinkage,rank:b.shrinkage},vector};
}
function validate(x){
 if(!x||x.model!==RELATION_MODEL||x.available!==true||!Number.isInteger(x.n)||x.n<10||x.n>120||!Array.isArray(x.symbols)||x.symbols.length<3||x.symbols.length>12||Array.from(x.symbols).some((s,i)=>typeof s!=='string'||!s.length||(i&&s<=x.symbols[i-1]))||!Array.isArray(x.vector)||x.vector.length!==x.symbols.length*(x.symbols.length-1)||Array.from(x.vector).some(v=>!Number.isFinite(v)||Math.abs(v)>1))throw Error('Invalid or unavailable relationship representation.');
}
export function relationContributions(a,b){
 validate(a);validate(b);
 if(a.n!==b.n||a.symbols.some((s,i)=>s!==b.symbols[i])||a.symbols.length!==b.symbols.length||a.ablation!==b.ablation)throw Error('Relationship comparisons require the same labelled assets, length and model variant.');
 const edges=a.vector.length/2,squared={linear:0,rank:0};for(let i=0;i<a.vector.length;i++)squared[i<edges?'linear':'rank']+=(a.vector[i]-b.vector[i])**2;
 return {distance:Math.sqrt(squared.linear+squared.rank),squared};
}
export const relationDistance=(a,b)=>relationContributions(a,b).distance;

export function relationHasEvidence(x){return !!(x?.available===true&&x.shrinkage&&(x.shrinkage.linear<1||(x.ablation!=='linear-only'&&x.shrinkage.rank<1)));}
