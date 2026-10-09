import {validCandle} from './data.js';
// Coverage is a computational prerequisite, never a confidence score.
export function dataCoverage(dataset,symbol,start,end){
 const rows=dataset[symbol]||[],length=end-start+1,symbols=Object.keys(dataset);
 const validSelection=Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end<rows.length&&length>=10&&length<=120;
 const maps=symbols.map(s=>new Map((dataset[s]||[]).filter(Boolean).map(r=>[r.date,r])));
 let aligned=0;
 if(validSelection&&symbols.length>=3&&symbols.length<=12){
  for(let i=end;i>=0;i--){
   const r=rows[i];if(!validCandle(r)||(i>0&&rows[i-1]?.date>=r.date)||!maps.every(m=>validCandle(m.get(r.date))))break;
   aligned++;
  }
 }
 const required=3*(length+60)+length;
 return {validSelection,length,assets:symbols.length,aligned,required,
  current:validSelection&&Array.from(rows.slice(start,end+1)).every(validCandle),
  basket:aligned>=length,context:validSelection&&end>=119,
  homology:validSelection&&aligned>=required,
  missing:Math.max(0,required-aligned)};
}
