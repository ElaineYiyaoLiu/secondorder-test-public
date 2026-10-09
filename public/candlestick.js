// Fixed, window-local embedding. No outcome data, fitted weights or time warping.
export const CANDLE_MODEL='candle-euclidean-v2';
export const CANDLE_WEIGHTS=Object.freeze({shape:.45,path:.25,volume:.15,regime:.15});
export const SCALE_FLOOR=1e-6; // dimensionless log price, not currency units
const median=a=>{const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
// Subtracting logs avoids overflow/underflow in price and volume ratios.
const logRatio=(a,b)=>Math.log(a)-Math.log(b);
function validate(rows){
 if(!Array.isArray(rows)||rows.length<10||rows.length>120)throw Error('Candlestick requires 10–120 sessions.');
 for(const r of rows)if(!r||![r.open,r.high,r.low,r.close,r.volume].every(Number.isFinite)||r.low<=0||r.volume<0||r.low>Math.min(r.open,r.close)||r.high<Math.max(r.open,r.close))throw Error('Invalid OHLC or volume in candlestick window.');
}
export function candleEmbedding(rows){
 validate(rows);const n=rows.length;
 const ranges=rows.map((r,i)=>{
  const previous=i?rows[i-1].close:r.open;
  return logRatio(Math.max(r.high,previous),Math.min(r.low,previous));
 });
 const scale=Math.max(SCALE_FLOOR,median(ranges));
 const shape=rows.flatMap((r,i)=>[
  i?logRatio(r.open,rows[i-1].close):0,
  logRatio(r.close,r.open),
  logRatio(r.high,Math.max(r.open,r.close)),
  logRatio(Math.min(r.open,r.close),r.low)
 ].map(x=>Math.asinh(x/scale)));
 const path=rows.map(r=>Math.asinh(logRatio(r.close,rows[0].open)/(scale*Math.sqrt(n))));
 const positive=rows.filter(r=>r.volume>0).map(r=>Math.log(r.volume));
 const center=positive.length?median(positive):0;
 const volume=rows.flatMap(r=>[r.volume>0?Math.asinh(Math.log(r.volume)-center):0,+(r.volume===0)]);
 const increments=rows.slice(1).map((r,i)=>logRatio(r.close,rows[i].close));
 const realized=Math.hypot(...increments)/Math.sqrt(n-1);
 const regime=[Math.log1p(scale/SCALE_FLOOR),Math.log1p(realized/SCALE_FLOOR)];
 const blocks={shape,path,volume,regime},vector=[];
 for(const [name,values] of Object.entries(blocks)){
  const factor=Math.sqrt(CANDLE_WEIGHTS[name]/values.length);
  for(const x of values)vector.push(x*factor);
 }
 return {model:CANDLE_MODEL,n,scale,realized,zeroVolumeCount:n-positive.length,vector};
}
export function candleDistance(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||a.length<72||a.length>842||(a.length-2)%7||a.some(x=>!Number.isFinite(x))||b.some(x=>!Number.isFinite(x)))throw Error('Incompatible candlestick vectors.');
 return Math.hypot(...a.map((x,i)=>x-b[i]));
}
export function candleContributions(a,b){
 const total=candleDistance(a,b),n=(a.length-2)/7,lengths={shape:4*n,path:n,volume:2*n,regime:2};let offset=0;
 const squared={};for(const [name,length] of Object.entries(lengths)){squared[name]=a.slice(offset,offset+length).reduce((s,x,i)=>s+(x-b[offset+i])**2,0);offset+=length;}
 return {distance:total,squared};
}
// Retained only for validation against the v0.1 baseline, never selected in the UI.
export function legacyCandle(rows){
 const base=rows[0].close,v=rows.reduce((s,r)=>s+r.volume,0)/rows.length||1;
 return rows.flatMap(r=>[Math.log(r.open/base),Math.log(r.high/base),Math.log(r.low/base),Math.log(r.close/base),Math.log((r.volume+1)/(v+1))/10]);
}
