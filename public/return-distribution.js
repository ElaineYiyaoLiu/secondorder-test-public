// Fixed rank weights and a fixed, strictly increasing return transform.
// No fitted normalization, quantile interpolation, trimming or future data.
export const DISTRIBUTION_MODEL='return-distribution-v2';
export const DISTRIBUTION_CONFIG=Object.freeze({returnUnit:.01,tailMass:.2,bulkWeight:.6,lowerWeight:.2,upperWeight:.2});
const variants=[null,'uniform','no-transform'];
const transform=(r,variant)=>variant==='no-transform'?r/DISTRIBUTION_CONFIG.returnUnit:Math.asinh(r/DISTRIBUTION_CONFIG.returnUnit);
function sortedValues(a){
 if(!Array.isArray(a)||!a.length||a.length>1000||Array.from(a).some(x=>!Number.isFinite(x)))throw Error('Distribution samples must be dense, finite and nonempty.');
 return [...a].sort((x,y)=>x-y);
}
// Merge empirical quantile cells. Integer endpoint comparisons avoid rounding
// a fractional tail boundary to a whole observation or advancing the wrong cell.
function integral(a,b,lo,hi){
 const n=a.length,m=b.length;let i=0,j=0,u=0,total=0;
 while(i<n&&j<m){
  const leftEnd=(i+1)*m,rightEnd=(j+1)*n,v=Math.min(leftEnd,rightEnd)/(n*m),width=Math.max(0,Math.min(v,hi)-Math.max(u,lo));
  if(width){const gap=Math.abs(a[i]-b[j]);total+=width*gap;}
  u=v;if(leftEnd<=rightEnd)i++;if(rightEnd<=leftEnd)j++;
  if(u>=hi)break;
 }
 if(!Number.isFinite(total))throw Error('Distribution distance exceeded numeric range.');
 return total===0?0:total;
}
export function empiricalW1(a,b,{lower=0,upper=1}={}){
 if(!Number.isFinite(lower)||!Number.isFinite(upper)||lower<0||upper>1||lower>=upper)throw Error('Invalid quantile interval.');
 return integral(sortedValues(a),sortedValues(b),lower,upper)/(upper-lower);
}
function tailMean(a,lo,hi){return a.reduce((s,x,i)=>s+x*Math.max(0,Math.min((i+1)/a.length,hi)-Math.max(i/a.length,lo)),0)/(hi-lo);}
export function distributionEmbedding(rows,{ablation=null}={}){
 if(!variants.includes(ablation))throw Error('Unknown distribution variant.');
 if(!Array.isArray(rows)||rows.length<10||rows.length>120||Array.from(rows).some((r,i)=>!r||typeof r.date!=='string'||!r.date.length||(i&&r.date<=rows[i-1]?.date)||!Number.isFinite(r.close)||r.close<=0))throw Error('Distribution windows need 10–120 increasing dates and finite positive closes.');
 const logs=rows.map(r=>Math.log(r.close)),logReturns=logs.slice(1).map((v,i)=>v-logs[i]).sort((a,b)=>a-b),m=logReturns.length,center=logReturns.reduce((s,x)=>s+x,0)/m,alpha=DISTRIBUTION_CONFIG.tailMass;
 return {model:DISTRIBUTION_MODEL,n:rows.length,ablation,logReturns,transformed:logReturns.map(r=>transform(r,ablation)),summary:{meanLogReturn:center,dailyRisk:Math.hypot(...logReturns.map(x=>x-center))/Math.sqrt(m),positiveFraction:logReturns.filter(x=>x>0).length/m,zeroFraction:logReturns.filter(x=>x===0).length/m,lowerTailMean:tailMean(logReturns,0,alpha),upperTailMean:tailMean(logReturns,1-alpha,1),maxAbsLogReturn:Math.max(...logReturns.map(Math.abs)),tailObservations:alpha*m}};
}
function validate(x){
 if(!x||x.model!==DISTRIBUTION_MODEL||!Number.isInteger(x.n)||x.n<10||x.n>120||!variants.includes(x.ablation)||!Array.isArray(x.logReturns)||x.logReturns.length!==x.n-1||!Array.isArray(x.transformed)||x.transformed.length!==x.n-1||Array.from(x.logReturns).some((r,i)=>!Number.isFinite(r)||(i&&r<x.logReturns[i-1]))||Array.from(x.transformed).some((r,i)=>!Number.isFinite(r)||Math.abs(r-transform(x.logReturns[i],x.ablation))>1e-12*Math.max(1,Math.abs(r))))throw Error('Invalid distribution representation.');
}
export function distributionComparison(a,b){
 validate(a);validate(b);if(a.ablation!==b.ablation)throw Error('Distribution variants differ.');
 const alpha=DISTRIBUTION_CONFIG.tailMass,bulk=integral(a.transformed,b.transformed,0,1),lower=integral(a.transformed,b.transformed,0,alpha)/alpha,upper=integral(a.transformed,b.transformed,1-alpha,1)/alpha;
 const weights=a.ablation==='uniform'?{bulk:1,lower:0,upper:0}:{bulk:DISTRIBUTION_CONFIG.bulkWeight,lower:DISTRIBUTION_CONFIG.lowerWeight,upper:DISTRIBUTION_CONFIG.upperWeight};
 const contributions={bulk:weights.bulk*bulk,lower:weights.lower*lower,upper:weights.upper*upper};
 return {distance:contributions.bulk+contributions.lower+contributions.upper,channels:{bulk,lower,upper},contributions,rawW1:integral(a.logReturns,b.logReturns,0,1)};
}
export const distributionDistance=(a,b)=>distributionComparison(a,b).distance;
