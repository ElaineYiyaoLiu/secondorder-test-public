import {validateHomology,mean} from './engine.js';
export async function validateStudy(engine,progress=()=>{}){
 const specs=[['topology','H₀ + H₁'],['h0','H₀ only'],['h1','H₁ only'],['correlation','Labelled correlation']],runs=[];
 for(const [retrieval,label] of specs)runs.push({retrieval,label,...await validateHomology(engine,n=>progress(n),{retrieval})});
 const maps=runs.map(r=>new Map(r.records.map(x=>[x.date,x]))),dates=runs[0].records.map(x=>x.date).filter(d=>maps.every(m=>m.has(d))),common=maps.map(m=>dates.map(d=>m.get(d))),baseline=dates.length?mean(common[0].map(r=>r.baselineError)):null,maes=common.map(rs=>rs.length?mean(rs.map(r=>r.error)):null);
 return {...runs[0],study:{commonCount:dates.length,dates,baseline,methods:runs.map((r,i)=>({id:r.retrieval,label:r.label,scored:r.n,mae:maes[i],delta:maes[i]===null||maes[3]===null?null:maes[i]-maes[3]}))}};
}
