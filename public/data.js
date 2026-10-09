import {demoCandles,stocks} from './market.js';
export const BASKET=['NVDA','AAPL','MSFT','AMZN','META','SPY','QQQ','TSLA'];
export function sampleDataset(symbol='NVDA',count=500){return Object.fromEntries([...new Set([...BASKET,symbol])].map(s=>[s,demoCandles(s,count)]));}
// Interactive illustration: a common market component plus asset-specific
// variation. Historical numerical fixtures above remain unchanged.
export function interactiveDataset(symbol='NVDA',count=850){
 const data=sampleDataset(symbol,count);
 for(const [s,rows] of Object.entries(data)){
  const index=Math.max(0,stocks.findIndex(x=>x.symbol===s)),loading=.8+(index%5)*.1;
  let common=0;
  rows.forEach((r,i)=>{common+=.012*Math.sin(i*1.731)+.012*Math.cos(i*.619);const factor=Math.exp(loading*common);for(const k of ['open','high','low','close'])r[k]*=factor;});
 }
 return data;
}
export function validCandle(r){
 if(!r||typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date))return false;
 const date=new Date(r.date+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===r.date&&[r.open,r.high,r.low,r.close,r.volume].every(Number.isFinite)&&r.low>0&&r.volume>=0&&r.low<=Math.min(r.open,r.close)&&r.high>=Math.max(r.open,r.close);
}
export function validateDataset(dataset){
 const symbols=Object.keys(dataset);if(!symbols.length||symbols.length>12)throw Error('Provide 1–12 symbols.');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 for(const symbol of symbols){
  if(!/^[A-Z0-9.^-]{1,16}$/.test(symbol))throw Error('Invalid ticker.');
  const rows=dataset[symbol];if(!Array.isArray(rows)||rows.length<10||rows.length>3000)throw Error('Provide 10–3000 completed daily bars per symbol.');
  rows.forEach((r,i)=>{if(!validCandle(r)||r.date>=today||(i&&r.date<=rows[i-1].date))throw Error('Check dates, OHLC, volume, duplicate rows, and sorting.');});
 }
 return dataset;
}
export function parseCSV(text){
 if(text.length>6000000)throw Error('CSV exceeds 6 MB.');
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/),header=lines.shift().toLowerCase().split(',').map(s=>s.trim()),fields=['symbol','date','open','high','low','close','volume'];
 if(fields.some(f=>!header.includes(f)))throw Error('Use columns: symbol,date,open,high,low,close,volume.');
 if(new Set(header).size!==header.length)throw Error('Duplicate CSV headers.');
 const dataset=Object.create(null);
 for(const line of lines){if(!line.trim())continue;const cells=line.split(',').map(s=>s.trim());if(cells.length!==header.length)throw Error('Each row must match the header; quoted fields are not supported.');const values=Object.fromEntries(header.map((h,i)=>[h,cells[i]])),symbol=values.symbol.toUpperCase();if(!/^[A-Z0-9.^-]{1,16}$/.test(symbol))throw Error('Invalid ticker.');if(fields.some(f=>!values[f]))throw Error('Missing value.');const row={date:values.date,...Object.fromEntries(['open','high','low','close','volume'].map(f=>[f,Number(values[f])]))};(dataset[symbol]??=[]).push(row);}
 return validateDataset(dataset);
}
export function instrument(symbol){return stocks.find(s=>s.symbol===symbol)||{symbol,name:symbol,zh:symbol};}
