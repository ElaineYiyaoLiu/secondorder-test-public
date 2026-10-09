// Window-local covariance state. The distance is affine invariant; the
// coordinatewise robust estimator and spherical prior are not.
export const MARKET_MODEL='market-state-spd-v2';
export const MARKET_CONFIG=Object.freeze({winsorLimit:4,scaleFloor:1e-6,variationFloor:1e-12,minShrinkage:.02});
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const median=a=>{const b=[...a].sort((x,y)=>x-y),i=Math.floor(b.length/2);return b.length%2?b[i]:(b[i-1]+b[i])/2;};
const transpose=a=>a[0].map((_,j)=>a.map(r=>r[j]));
function checkedMatrix(a){
 const p=a?.length;
 if(!Array.isArray(a)||!Number.isInteger(p)||p<1||p>12||Array.from(a).some((r,i)=>!Array.isArray(r)||r.length!==p||Array.from(r).some((x,j)=>!Number.isFinite(x)||!Number.isFinite(a[j]?.[i]))))throw Error('Expected a finite square matrix of dimension 1–12.');
 const scale=Math.max(...a.flat().map(Math.abs));if(!scale)throw Error('Zero matrix is not positive definite.');
 if(a.some((r,i)=>r.some((x,j)=>Math.abs(x/scale-a[j][i]/scale)>1e-12)))throw Error('Matrix must be symmetric.');
 return {scale,matrix:a.map((r,i)=>r.map((x,j)=>(x/scale+a[j][i]/scale)/2))};
}
export function symmetricEigen(a){
 const n=a.length,b=a.map(r=>[...r]);
 for(let k=0;k<80*n*n;k++){
  let p=0,q=0,m=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(b[i][j])>m){p=i;q=j;m=Math.abs(b[i][j]);}
  const scale=Math.max(...b.map((r,i)=>Math.abs(r[i])),Number.MIN_VALUE);
  if(m<=2e-14*scale)return b.map((r,i)=>r[i]);
  const theta=.5*Math.atan2(2*b[p][q],b[q][q]-b[p][p]),c=Math.cos(theta),s=Math.sin(theta),pp=b[p][p],qq=b[q][q],pq=b[p][q];
  for(let i=0;i<n;i++)if(i!==p&&i!==q){const x=b[i][p],y=b[i][q];b[i][p]=b[p][i]=c*x-s*y;b[i][q]=b[q][i]=s*x+c*y;}
  b[p][p]=c*c*pp-2*s*c*pq+s*s*qq;b[q][q]=s*s*pp+2*s*c*pq+c*c*qq;b[p][q]=b[q][p]=0;
 }
 throw Error('Symmetric eigensolver failed to converge.');
}
function cholesky(a){
 const n=a.length,l=Array.from({length:n},()=>Array(n).fill(0));
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
  let x=a[i][j];for(let k=0;k<j;k++)x-=l[i][k]*l[j][k];
  if(i===j){if(!(x>0)||!Number.isFinite(x))throw Error('Matrix is not numerically positive definite.');l[i][j]=Math.sqrt(x);}else l[i][j]=x/l[j][j];
 }
 return l;
}
function lowerSolve(l,b){const out=[];for(let i=0;i<l.length;i++){out[i]=[];for(let j=0;j<b[0].length;j++){let x=b[i][j];for(let k=0;k<i;k++)x-=l[i][k]*out[k][j];out[i][j]=x/l[i][i];}}return out;}
function directional(a,b,scaleLog){
 const l=cholesky(a),x=lowerSolve(l,b),c=lowerSolve(l,transpose(x));
 const symmetric=c.map((r,i)=>r.map((v,j)=>(v+c[j][i])/2)),values=symmetricEigen(symmetric);
 if(values.some(v=>!(v>0)||!Number.isFinite(v)))throw Error('Generalized eigenvalues must be positive and finite.');
 return values.map(v=>Math.log(v)+scaleLog);
}
export function spdComparison(a,b){
 const x=checkedMatrix(a),y=checkedMatrix(b);if(a.length!==b.length)throw Error('Matrix dimensions differ.');
 cholesky(x.matrix);cholesky(y.matrix);
 const scaleLog=Math.log(y.scale)-Math.log(x.scale),forward=directional(x.matrix,y.matrix,scaleLog),reverse=directional(y.matrix,x.matrix,-scaleLog);
 const total=(forward.reduce((s,v)=>s+v*v,0)+reverse.reduce((s,v)=>s+v*v,0))/2,p=a.length;
 // The mean generalized log eigenvalue isolates volume from unit-determinant shape.
 const fmean=mean(forward),rmean=mean(reverse),volume=(fmean-rmean)/2;
 const shape=(mean(forward.map(v=>(v-fmean)**2))+mean(reverse.map(v=>(v-rmean)**2)))/2;
 return {distance:Math.sqrt(total),normalized:Math.sqrt(total/p),logVolumeRatio:volume,shapeDistance:Math.sqrt(shape)};
}
export const spdDistance=(a,b)=>spdComparison(a,b).distance;
export function marketEmbedding(basket,symbols,{ablation=null}={}){
 if(![null,'no-winsor','fixed-shrink'].includes(ablation))throw Error('Unknown market-state ablation.');
 if(!Array.isArray(basket)||basket.length<3||basket.length>12||!Array.isArray(symbols)||symbols.length!==basket.length||Array.from(symbols).some(s=>typeof s!=='string'||!s.length)||new Set(symbols).size!==symbols.length)throw Error('Provide 3–12 distinct labelled assets.');
 const n=basket[0]?.length;
 if(!Number.isInteger(n)||n<10||n>120||Array.from(basket).some(rows=>!Array.isArray(rows)||rows.length!==n||Array.from(rows).some((r,i)=>!r||typeof r.date!=='string'||!r.date.length||(i&&r.date<=rows[i-1]?.date)||r.date!==basket[0][i]?.date||!Number.isFinite(r.close)||r.close<=0)))throw Error('Market-state windows need aligned increasing dates and finite positive closes.');
 const order=symbols.map((s,i)=>({s,i})).sort((a,b)=>a.s<b.s?-1:a.s>b.s?1:0),names=order.map(x=>x.s),m=n-1,p=names.length,clipped=[],invalid=[],series=[];
 for(const {s,i} of order){
  const logs=basket[i].map(r=>Math.log(r.close)),r=logs.slice(1).map((v,k)=>v-logs[k]),center=median(r),scale=Math.max(MARKET_CONFIG.scaleFloor,1.482602218505602*median(r.map(v=>Math.abs(v-center))));
  const bounded=r.map(v=>ablation==='no-winsor'?v:center+Math.max(-MARKET_CONFIG.winsorLimit*scale,Math.min(MARKET_CONFIG.winsorLimit*scale,v-center))),mu=mean(bounded),residual=bounded.map(v=>v-mu);
  if(Math.hypot(...residual)/Math.sqrt(m)<=MARKET_CONFIG.variationFloor)invalid.push(s);
  clipped.push(r.filter(v=>Math.abs(v-center)>MARKET_CONFIG.winsorLimit*scale).length);series.push(residual);
 }
 const info={model:MARKET_MODEL,n,symbols:names,available:!invalid.length,invalidAssets:invalid,clippedReturns:clipped,ablation};
 if(invalid.length)return {...info,reason:'Insufficient return variation; covariance state is unavailable.'};
 const empirical=series.map(a=>series.map(b=>a.reduce((s,v,k)=>s+v*b[k],0)/m)),mu=mean(empirical.map((r,i)=>r[i]));
 const normalized=empirical.map(r=>r.map(v=>v/mu)),tr2=normalized.flat().reduce((s,v)=>s+v*v,0),den=(m+1-2/p)*(tr2-p);
 const oas=den<=1e-12?1:Math.min(1,Math.max(0,((1-2/p)*tr2+p*p)/den));
 const shrinkage=ablation==='fixed-shrink'?.1:Math.max(MARKET_CONFIG.minShrinkage,oas);
 const covariance=empirical.map((r,i)=>r.map((v,j)=>(1-shrinkage)*v+(i===j?shrinkage*mu:0)));
 const logDet=2*cholesky(covariance.map(r=>r.map(v=>v/mu))).reduce((s,r,i)=>s+Math.log(r[i]),0)+p*Math.log(mu);
 return {...info,covariance,shrinkage,oasShrinkage:oas,averageVariance:mu,dailyVolatility:covariance.map((r,i)=>Math.sqrt(r[i])),logDet,conditionBound:p/shrinkage};
}
function validate(x){
 if(!x||x.model!==MARKET_MODEL||x.available!==true||!Number.isInteger(x.n)||x.n<10||x.n>120||!Array.isArray(x.symbols)||x.symbols.length<3||x.symbols.length>12||Array.from(x.symbols).some((s,i)=>typeof s!=='string'||!s.length||(i&&s<=x.symbols[i-1]))||!Array.isArray(x.covariance)||x.covariance.length!==x.symbols.length||![null,'no-winsor','fixed-shrink'].includes(x.ablation))throw Error('Invalid or unavailable market-state representation.');
}
export function marketComparison(a,b){
 validate(a);validate(b);
 if(a.n!==b.n||a.symbols.length!==b.symbols.length||a.symbols.some((s,i)=>s!==b.symbols[i])||a.ablation!==b.ablation)throw Error('Market-state comparisons require the same labelled assets, length and variant.');
 return spdComparison(a.covariance,b.covariance);
}
export const marketDistance=(a,b)=>marketComparison(a,b).normalized;
