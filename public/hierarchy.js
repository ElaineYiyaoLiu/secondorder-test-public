// A fixed rooted tree on quantized window states. No fitting to future outcomes.
export const HIERARCHY_MODEL='hierarchical-state-v2';
export const HIERARCHY_CONFIG=Object.freeze({refinementBits:6,depth:28,decay:.25,returnFloor:.001,winsorMAD:3,trendNeutral:.5,balanceNeutral:.1,volumeNeutral:Math.log(1.2)});
const median=a=>{const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:s[i-1]/2+s[i]/2;};
const quantile=(a,p)=>{const s=[...a].sort((x,y)=>x-y),k=(s.length-1)*p,i=Math.floor(k);return s[i]+(s[Math.ceil(k)]-s[i])*(k-i);};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const squash=x=>.5+.5*Math.tanh(x);
const softplus=x=>Math.max(0,x)+Math.log1p(Math.exp(-Math.abs(x)));
const cuts=[ [0,...[.005,.015,.04].map(x=>{const y=Math.log1p(x/.01);return y/(1+y);}),1], [0,squash(-.5),squash(.5),1], [0,.45,.55,1], [0,squash(-Math.log(1.2)),squash(Math.log(1.2)),1] ];
const names=[['quiet','moderate','high','extreme'],['down','neutral','up'],['negative','neutral','positive'],['contracting','neutral','expanding']];
function validateRows(rows){
 if(!Array.isArray(rows)||rows.length<10||rows.length>120)throw Error('Hierarchy requires 10–120 sessions.');
 for(const r of rows)if(!r||![r.open,r.high,r.low,r.close,r.volume].every(Number.isFinite)||r.low<=0||r.volume<0||r.low>Math.min(r.open,r.close)||r.high<Math.max(r.open,r.close))throw Error('Invalid hierarchy OHLC or volume.');
}
export function hierarchyEmbedding(rows){
 validateRows(rows);const n=rows.length,r=rows.slice(1).map((v,i)=>Math.log(v.close)-Math.log(rows[i].close)),center=median(r),mad=median(r.map(x=>Math.abs(x-center))),limit=3*Math.max(.001,1.4826*mad,(quantile(r,.75)-quantile(r,.25))/1.349),robust=r.map(x=>clamp(x,center-limit,center+limit));
 const drift=robust.reduce((s,x)=>s+x,0)/r.length,volatility=Math.hypot(...robust.map(x=>x-drift))/Math.sqrt(r.length),trend=drift*Math.sqrt(r.length)/Math.max(.001,volatility);
 // Relative-to-high arithmetic prevents high-low overflow at extreme price units.
 const balance=median(rows.map(v=>{const range=1-v.low/v.high;return range?(v.close/v.high-v.open/v.high)/range:0;}));
 const positive=rows.filter(v=>v.volume>0).map(v=>Math.log(v.volume)),volumeCenter=positive.length?median(positive):0,volumeLogs=rows.map(v=>v.volume?softplus(Math.log(v.volume)-volumeCenter):0),split=Math.floor(n/2),volumeChange=median(volumeLogs.slice(split))-median(volumeLogs.slice(0,split));
 const coverage=positive.length===0?0:positive.length===n?2:1,level=Math.log1p(volatility/.01),values=[level/(1+level),squash(trend),(1+clamp(balance,-1,1))/2,squash(volumeChange)],coarse=[],bins=[],boundaryMargins=[];
 for(let j=0;j<4;j++){
  const c=cuts[j],x=values[j];let category=0;while(category<c.length-2&&x>=c[category+1])category++;
  coarse.push(category);bins.push(Math.min(63,Math.floor(64*clamp((x-c[category])/(c[category+1]-c[category]),0,1))));boundaryMargins.push(Math.min(...c.slice(1,-1).map(v=>Math.abs(v-x))));
 }
 const prefix=[...coarse];prefix[3]=3*coarse[3]+coverage;
 for(let bit=5;bit>=0;bit--)for(const b of bins)prefix.push((b>>bit)&1);
 return {model:HIERARCHY_MODEL,n,prefix,summary:{volatility,drift,trend,balance,volumeChange,volumeCoverage:coverage,zeroVolumeCount:n-positive.length,clippedReturns:r.filter((x,i)=>x!==robust[i]).length,coarse:coarse.map((c,j)=>names[j][c]),boundaryMargins}};
}
function validateState(a){
 if(!a||a.model!==HIERARCHY_MODEL||!Number.isInteger(a.n)||a.n<10||a.n>120||!Array.isArray(a.prefix)||a.prefix.length!==28||Array.from(a.prefix).some((x,i)=>!Number.isInteger(x)||x<0||x>(i===0?3:i===3?8:i<4?2:1)))throw Error('Invalid hierarchy state.');
}
export function hierarchyComparison(a,b){
 validateState(a);validateState(b);if(a.n!==b.n)throw Error('Hierarchy requires equal window lengths.');
 let sharedDepth=0;while(sharedDepth<28&&a.prefix[sharedDepth]===b.prefix[sharedDepth])sharedDepth++;
 return {distance:sharedDepth===28?0:2**(-sharedDepth/4),sharedDepth,depth:28,sameLeaf:sharedDepth===28,firstDifference:sharedDepth<28?['volatility','trend','balance','volume'][sharedDepth%4]:null};
}
export const hierarchyDistance=(a,b)=>hierarchyComparison(a,b).distance;
