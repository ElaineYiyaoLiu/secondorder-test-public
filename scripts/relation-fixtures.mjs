export function generator(seed){let state=seed;const uniform=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/2**32;};return {uniform,normal:()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform())};}
export function fromReturns(series){return Object.fromEntries(series.map((values,j)=>{let price=100;return [`S${j}`,Array.from({length:values.length+1},(_,i)=>{const open=price;price*=Math.exp(i?values[i-1]:0);return {date:new Date(Date.UTC(2010,0,1+i)).toISOString().slice(0,10),open,close:price,high:Math.max(open,price)*1.001,low:Math.min(open,price)/1.001,volume:1e6};})];}));}
export function estimationFixture(seed,kind,n=30,p=6){
 const rng=generator(seed),series=Array.from({length:p},()=>[]),truth=Array.from({length:p},(_,i)=>Array.from({length:p},(_,j)=>i===j?1:kind==='independent'?0:.4*(i%3===0?-1:1)*(j%3===0?-1:1)+.3*+(i%2===j%2)));
 for(let t=0;t<n-1;t++){
  const common=rng.normal(),sector=[rng.normal(),rng.normal()];
  for(let j=0;j<p;j++){
   const r=kind==='independent'?.015*rng.normal():.015*(Math.sqrt(.4)*(j%3===0?-1:1)*common+Math.sqrt(.3)*sector[j%2]+Math.sqrt(.3)*rng.normal());
   series[j].push(r+(kind==='contaminated'&&rng.uniform()<.04?.25*rng.normal():0));
  }
 }
 return {dataset:fromReturns(series),truth};
}
export function forecastFixture(seed,kind,n=1200,p=6){
 const rng=generator(seed),series=Array.from({length:p},()=>[]);
 for(let t=0;t<n-1;t++){
  const high=Math.floor(t/120)%2===0,rho=kind==='null'?.4:high?.7:.1,common=rng.normal(),drift=kind==='linked-drift'?(high?.002:-.002):0;
  for(let j=0;j<p;j++)series[j].push(drift+.015*(Math.sqrt(rho)*common+Math.sqrt(1-rho)*rng.normal()));
 }
 return fromReturns(series);
}
