import test from 'node:test';
import assert from 'node:assert/strict';
import {pathEmbedding,pathDistance,pathComparison,PATH_CONFIG as C} from '../public/price-path.js';
import {makeEngine,tournament,distance,state} from '../public/legacy-engine.js';
import {sampleDataset} from '../public/data.js';
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const rows=(values)=>values.map(close=>({close}));
const embed=values=>pathEmbedding(rows(values));
const fixture=sampleDataset().NVDA.slice(0,30);
// Exhaustive path enumeration is independent of the dynamic-programming recurrence.
function oracle(a,b){
 const n=a.n,band=Math.ceil(n*.1);let best=Infinity;
 const local=(i,j)=>C.levelWeight*(a.level[i]-b.level[j])**2+C.slopeWeight*(a.slope[i]-b.slope[j])**2+C.timePenalty*((i-j)/band)**2;
 function visit(i,j,dir,run,cost){
  if(i===n-1&&j===n-1){best=Math.min(best,cost);return;}
  for(const [di,dj,next] of [[1,1,0],[0,1,1],[1,0,2]]){
   const ni=i+di,nj=j+dj,r=next===dir?run+1:1;
   if(ni>=n||nj>=n||Math.abs(ni-nj)>band||next&&((dir&&dir!==next)||r>C.maxRun))continue;
   visit(ni,nj,next,next?r:0,cost+(di+dj)*local(ni,nj)+(next?C.warpPenalty:0));
  }
 }
 visit(0,0,0,0,2*local(0,0));return best/(2*n);
}
test('unit invariance, close-only representation and serialization',()=>{
 const a=pathEmbedding(fixture);
 for(const factor of [1e-200,.001,10,1e200])near(pathDistance(a,pathEmbedding(fixture.map(r=>({...r,close:r.close*factor})))),0);
 const b=pathEmbedding(fixture.map(r=>({close:r.close,volume:NaN,open:-1})));assert.deepEqual(a,b);
 assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
});
test('flat, minimum, maximum, nearly-flat and extreme finite positive closes',()=>{
 for(const values of [Array(10).fill(1),Array(120).fill(1e-300),Array.from({length:30},(_,i)=>i%2?1e300:1e-300),Array.from({length:30},(_,i)=>100+i*1e-12)]){
  const a=embed(values);near(pathDistance(a,a),0);assert.ok(Number.isFinite(pathDistance(a,embed(Array(values.length).fill(100)))));
 }
});
test('invalid input and incompatible representations reject explicitly',()=>{
 for(const input of [null,[],Array(10),rows(Array(9).fill(1)),rows(Array(121).fill(1)),rows([0,...Array(9).fill(1)]),rows([NaN,...Array(9).fill(1)]),rows([Infinity,...Array(9).fill(1)]),rows([-1,...Array(9).fill(1)])])assert.throws(()=>pathEmbedding(input));
 const a=embed(Array(10).fill(1));for(const b of [{...a,n:11},{...a,model:'unknown'},{...a,level:[NaN,...a.level.slice(1)]},{...a,regime:[1e300,0]},{...a,level:Array(10)},{...a,endpoint:Array(2)}])assert.throws(()=>pathDistance(a,b));
 assert.throws(()=>pathDistance(a,embed(Array(11).fill(1))));assert.throws(()=>pathComparison(a,a,{ablation:'unknown'}));
 assert.throws(()=>makeEngine(sampleDataset(),'NVDA',{pathModel:'unknown'}));
});
test('dynamic programming matches exhaustive optimal alignment on short paths',()=>{
 for(let k=0;k<8;k++){
  const a=embed(Array.from({length:10},(_,i)=>Math.exp(.02*Math.sin(i+k))));
  const b=embed(Array.from({length:10},(_,i)=>Math.exp(.015*Math.cos(2*i+k))));
  near(pathComparison(a,b).squared.alignment/C.alignmentWeight,oracle(a,b),1e-12);
 }
});
test('500 random pairs: symmetry, identity, finiteness, valid optimal trace and fixed normalization',()=>{
 let seed=621;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 const random=n=>{let p=100;return embed(Array.from({length:n},()=>p*=Math.exp((rand()-.5)*.08)));};
 for(let k=0;k<500;k++){
  const n=10+Math.floor(rand()*111),a=random(n),b=random(n),r=pathComparison(a,b,{trace:true});
  assert.ok(Number.isFinite(r.distance)&&r.distance>=0);near(r.distance,pathDistance(b,a));near(pathDistance(a,a),0);
  assert.deepEqual(r.path[0],[0,0]);assert.deepEqual(r.path.at(-1),[n-1,n-1]);let total=2,last=0,run=0,sum=0;
  for(let p=0;p<r.path.length;p++){
   const [i,j]=r.path[p];assert.ok(Math.abs(i-j)<=r.band);
   let factor=2,axial=false;
   if(p){const [pi,pj]=r.path[p-1],di=i-pi,dj=j-pj;assert.ok(di>=0&&dj>=0&&di<=1&&dj<=1&&di+dj>0);factor=di+dj;total+=factor;axial=factor===1;const dir=axial?(di?2:1):0;assert.ok(!dir||!last||dir===last);run=dir&&dir===last?run+1:1;assert.ok(!dir||run<=2);last=dir;}
   sum+=factor*(C.levelWeight*(a.level[i]-b.level[j])**2+C.slopeWeight*(a.slope[i]-b.slope[j])**2+C.timePenalty*((i-j)/r.band)**2)+(axial?C.warpPenalty:0);
  }
  assert.equal(total,2*n);near(sum/(2*n),r.squared.alignment/C.alignmentWeight);near(Object.values(r.squared).reduce((s,x)=>s+x,0),r.distance**2);
  assert.ok(r.distance<=pathComparison(a,b,{ablation:'no-warp'}).distance+1e-12);
 }
});
test('drift sign, temporal order, volatility and endpoint remain distinguishable',()=>{
 const base=Array.from({length:30},(_,i)=>Math.exp(.01*i)),a=embed(base),b=embed(base.map(x=>x*x));
 assert.ok(pathComparison(a,b).squared.regime>0);assert.ok(pathComparison(a,b).squared.endpoint>0);
 assert.ok(pathDistance(a,embed([...base].reverse()))>0);
 const increments=[.03,-.02,.01,...Array(26).fill(0)],path=r=>{let p=100;return [p,...r.map(x=>p*=Math.exp(x))];};
 assert.ok(pathDistance(embed(path(increments)),embed(path([...increments].reverse())))>0);
});
test('time stretching cannot give distinct paths zero distance',()=>{
 const a=embed([1,1,1,1,2,2,2,2,2,2]),b=embed([1,1,1,2,2,2,2,2,2,2]);
 assert.ok(pathDistance(a,b)>0);
 const r=pathComparison(a,b,{trace:true});assert.ok(r.warpSteps>0);assert.ok(r.distance<pathComparison(a,b,{ablation:'no-warp'}).distance);
});
test('future data cannot change path retrieval or historical predictions',async()=>{
 const ds=sampleDataset(),changed=structuredClone(ds);for(const s of Object.keys(changed))changed[s]=[...changed[s].slice(0,430),...changed[s].slice(430).map(r=>({...r,open:r.open*2,high:r.high*2,low:r.low*2,close:r.close*2})),...changed[s].slice(430).map((r,i)=>({...r,date:new Date(Date.parse(ds.NVDA.at(-1).date)+86400000*(i+1)).toISOString().slice(0,10)}))];
 assert.deepEqual(makeEngine(ds,'NVDA').find(400,429,['dtw']),makeEngine(changed,'NVDA').find(400,429,['dtw']));
 const [a]=await tournament(makeEngine(ds,'NVDA'),['dtw']),[b]=await tournament(makeEngine(changed,'NVDA'),['dtw']);
 for(const r of a.records.filter(r=>r.date<=ds.NVDA[429].date)){const other=b.records.find(x=>x.date===r.date);near(r.prediction,other.prediction);near(r.base,other.base);}
});
test('seven other representations and retrieval rankings remain unchanged',()=>{
 const ds=sampleDataset(),old=makeEngine(ds,'NVDA',{pathModel:'legacy'}),next=makeEngine(ds,'NVDA'),ids=['euclidean','correlation','riemannian','wasserstein','topology','ultrametric','signature'];
 const a=old.find(400,429,ids),b=next.find(400,429,ids);assert.deepEqual(a.rankings,b.rankings);assert.deepEqual(a.analogues,b.analogues);
 for(const id of ids)assert.deepEqual(a.target[id],b.target[id]);
 assert.equal(distance('dtw',b.target.dtw,b.target.dtw),0);assert.equal(state(fixture).dtw.model,'price-path-dtw-v2');
});
test('isolated return spike cannot change the robust scale of ordinary steps',()=>{
 const values=Array.from({length:30},(_,i)=>100*Math.exp(i*.01)),a=embed(values),b=embed(values.map((x,i)=>i>=15?x*1e50:x));
 near(a.scale,b.scale);near(a.slope[10],b.slope[10]);assert.ok(b.realized>a.realized);assert.ok(pathComparison(a,b).squared.regime>0);
});
test('ablation options are restricted and defaults are deterministic',()=>{
 const ds=sampleDataset();assert.throws(()=>makeEngine(ds,'NVDA',{pathAblation:'unknown'}));assert.throws(()=>makeEngine(ds,'NVDA',{pathModel:'legacy',pathAblation:'no-warp'}));
 const a=makeEngine(ds,'NVDA').find(400,429,['dtw']);assert.deepEqual(a,makeEngine(ds,'NVDA').find(400,429,['dtw']));
 for(const pathAblation of ['no-warp','no-slope','no-regime'])assert.ok(makeEngine(ds,'NVDA',{pathAblation}).find(400,429,['dtw']).analogues.length>0);
});

