// Pair by date, never by array position or method-specific origin eligibility.
export function commonEvaluation(methods){
 const entries=Object.entries(methods);if(!entries.length)throw Error('No evaluation methods.');
 const maps=Object.fromEntries(entries.map(([id,records])=>{
  const map=new Map();for(const r of records){if(!r||typeof r.date!=='string'||map.has(r.date)||![r.actual,r.prediction,r.base].every(Number.isFinite))throw Error('Invalid or duplicate evaluation origin.');map.set(r.date,r);}
  return [id,map];
 }));
 const dates=entries[0][1].map(r=>r.date).filter(date=>entries.every(([id])=>maps[id].has(date)));
 if(!dates.length)throw Error('No common scored origins.');
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,first=maps[entries[0][0]];
 for(const date of dates)for(const [id] of entries){const a=first.get(date),b=maps[id].get(date);if(a.actual!==b.actual||a.base!==b.base)throw Error('Mismatched outcomes or baseline.');}
 const mae=Object.fromEntries(entries.map(([id])=>[id,mean(dates.map(date=>{const r=maps[id].get(date);return Math.abs(r.prediction-r.actual);} ))]));
 const coverage=Object.fromEntries(entries.map(([id,records])=>[id,{available:records.length,excluded:records.filter(r=>!dates.includes(r.date)).map(r=>r.date)}]));
 return {n:dates.length,dates,mae,coverage,unconditionalMAE:mean(dates.map(date=>{const r=first.get(date);return Math.abs(r.base-r.actual);})),zeroMAE:mean(dates.map(date=>Math.abs(first.get(date).actual)))};
}
