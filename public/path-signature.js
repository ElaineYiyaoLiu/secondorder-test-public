// Step-2 log signatures of a transformed, time-augmented piecewise-linear path.
export const SIGNATURE_MODEL='path-order-signature-v2';
export const SIGNATURE_CONFIG=Object.freeze({priceUnit:.01,signatureWeight:.85,anchorWeight:.15,globalWeight:.4,halvesWeight:.35,quartersWeight:.25,levelWeight:.5,areaWeight:.5});
export const SIGNATURE_PAIRS=Object.freeze([[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].map(Object.freeze));
const median=a=>{const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:s[i-1]/2+s[i]/2;};
const variants=[null,'global-only','no-time'];
// Canonical coordinates: displacement then half-antisymmetric iterated integrals.
export function logSignature2(points){
 if(!Array.isArray(points)||points.length<2||points.length>500||Array.from(points).some(p=>!Array.isArray(p)||p.length!==4||Array.from(p).some(v=>!Number.isFinite(v)||Math.abs(v)>1e4)))throw Error('Invalid four-channel path.');
 const end=[0,0,0,0],area=Array(6).fill(0);
 for(let k=1;k<points.length;k++){const dx=points[k].map((v,i)=>v-points[k-1][i]);for(let j=0;j<6;j++){const [a,b]=SIGNATURE_PAIRS[j];area[j]+=(end[a]*dx[b]-end[b]*dx[a])/2;}for(let j=0;j<4;j++)end[j]+=dx[j];}
 return [...end,...area];
}
function at(points,t){const x=t*(points.length-1),i=Math.min(points.length-2,Math.floor(x)),f=x-i;return points[i].map((v,j)=>v+(points[i+1][j]-v)*f);}
export function segmentPath(points,start,end,{noTime=false}={}){
 if(!Array.isArray(points)||points.length<2||points.length>120||Array.from(points).some(p=>!Array.isArray(p)||p.length!==4||Array.from(p).some(x=>!Number.isFinite(x)||Math.abs(x)>1e4))||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>1||start>=end)throw Error('Invalid signature segment.');
 const times=[start];for(let i=1;i<points.length-1;i++){const t=i/(points.length-1);if(t>start&&t<end)times.push(t);}times.push(end);
 return times.map(t=>{const p=at(points,t);p[0]=noTime?0:(t-start)/(end-start);return p;});
}
export function signatureEmbedding(rows,{ablation=null}={}){
 if(!variants.includes(ablation))throw Error('Unknown signature ablation.');
 if(!Array.isArray(rows)||rows.length<10||rows.length>120||Array.from(rows).some(r=>!r||![r.open,r.high,r.low,r.close,r.volume].every(Number.isFinite)||r.low<=0||r.volume<0||r.low>Math.min(r.open,r.close)||r.high<Math.max(r.open,r.close)))throw Error('Signature requires 10–120 valid OHLCV sessions.');
 const n=rows.length,logs=rows.map(r=>Math.log(r.close)),positive=rows.filter(r=>r.volume>0).map(r=>Math.log(r.volume)),volumeCenter=positive.length?median(positive):0;
 const points=rows.map((r,i)=>[i/(n-1),Math.asinh((logs[i]-logs[0])/.01),r.volume?Math.asinh(Math.log(r.volume)-volumeCenter):0,+(r.volume===0)]);
 const blocks=[];for(const count of [1,2,4])for(let k=0;k<count;k++)blocks.push(logSignature2(segmentPath(points,k/count,(k+1)/count,{noTime:ablation==='no-time'})));
 const returns=logs.slice(1).map((v,i)=>v-logs[i]),realized=Math.hypot(...returns)/Math.sqrt(n-1),volumeVariation=Math.hypot(...points.slice(1).map((p,i)=>p[2]-points[i][2]))/Math.sqrt(n-1),zeroVolumeCount=n-positive.length;
 const anchors=[Math.log1p(realized/.01),Math.log1p(volumeVariation),zeroVolumeCount/n],vector=[];
 for(let i=0;i<7;i++){const count=i===0?1:i<3?2:4,weight=ablation==='global-only'?(i===0?1:0):count===1?.4:count===2?.35:.25;for(let j=0;j<10;j++)vector.push(Math.asinh(blocks[i][j])*Math.sqrt(.85*weight/count*.5/(j<4?4:6)));}
 for(const x of anchors)vector.push(x*Math.sqrt(.15/3));
 return {model:SIGNATURE_MODEL,n,ablation,points,blocks,anchors,vector,summary:{realized,volumeVariation,zeroVolumeCount,globalTimePriceArea:blocks[0][4],globalPriceVolumeArea:blocks[0][7]}};
}
function validate(a){if(!a||a.model!==SIGNATURE_MODEL||!Number.isInteger(a.n)||a.n<10||a.n>120||!variants.includes(a.ablation)||!Array.isArray(a.vector)||a.vector.length!==73||Array.from(a.vector).some(x=>!Number.isFinite(x)||Math.abs(x)>1e4))throw Error('Invalid signature representation.');}
export function signatureComparison(a,b){
 validate(a);validate(b);if(a.n!==b.n||a.ablation!==b.ablation)throw Error('Incompatible signature states.');
 const ranges={global:[0,10],halves:[10,30],quarters:[30,70],anchors:[70,73]},squared={};for(const [name,[lo,hi]] of Object.entries(ranges))squared[name]=a.vector.slice(lo,hi).reduce((s,x,i)=>s+(x-b.vector[lo+i])**2,0);
 return {distance:Math.hypot(...a.vector.map((x,i)=>x-b.vector[i])),squared};
}
export const signatureDistance=(a,b)=>signatureComparison(a,b).distance;

