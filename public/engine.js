import {analyzePeriod,mean,quantile,resampleBasket,status} from './analysis.js';
import {topologyEmbedding,topologyComparison} from './topology.js';
import {validCandle} from './data.js';
export {mean,quantile} from './analysis.js';
export const GEOMETRIES=[
 {id:'euclidean',name:'Candlestick structure',zh:'K 线结构',family:'STRUCTURE',math:'Window-local candle statistics',note:'Bodies, wicks and overnight gaps describe daily structure.',cn:'实体、影线与隔夜跳空描述日线结构。'},
 {id:'dtw',name:'Price path',zh:'价格路径',family:'PATH',math:'Path efficiency · drawdown · slopes',note:'Net movement, reversals and drawdown locations in the selected period.',cn:'描述选中区间的净变化、往返和回撤位置。'},
 {id:'correlation',name:'Asset relationships',zh:'资产关系',family:'RELATION',math:'Robust linear / rank correlation',note:'Labelled links with shrinkage and joint block-resampling sensitivity.',cn:'具名资产关联，保留收缩与联合分块重采样敏感度。',basket:true},
 {id:'riemannian',name:'Basket risk',zh:'资产组风险',family:'RISK',math:'Equal-weight covariance · adjacent SPD change',note:'Equal-weight daily risk and contributions; compare only the adjacent complete window.',cn:'等权日风险及贡献；仅与紧邻的完整窗口比较。',basket:true},
 {id:'wasserstein',name:'Return distribution',zh:'收益分布',family:'DISTRIBUTION',math:'Raw tails · adjacent quantile transport',note:'Observed daily moves and tails; distribution change from the adjacent period.',cn:'观察日收益及尾部，并分析与相邻区间的分布变化。'},
 {id:'ultrametric',name:'Multiscale state',zh:'多尺度状态',family:'CONTEXT',math:'20 / 60 / 120-session state context',note:'States ending at the selection endpoint. A derived overview, sharing underlying observations.',cn:'截至选中区间终点的多尺度状态，是共享底层观测的汇总视角。'},
 {id:'signature',name:'Price-volume order',zh:'价量路径顺序',family:'ORDER',math:'Segmented step-2 log signature',note:'Observed price-volume event order and exploratory segment areas.',cn:'已发生的价量事件顺序与探索性分段面积。'},
 {id:'topology',name:'Homology historical comparison',zh:'Homology 历史对比',family:'HOMOLOGY',math:'Rips H₀ / H₁ · exact diagram W₂',note:'Find earlier periods with similar relationships between assets, then inspect what happened afterwards.',cn:'寻找资产关系结构相似的过去区间，再查看后来发生了什么。',basket:true,historical:true}
];
export const ANALYSIS_IDS=GEOMETRIES.filter(g=>!g.historical).map(g=>g.id);
function validateSelection(rows,start,end){if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>=rows.length||end-start+1<10||end-start+1>120)throw Error('Select 10–120 sessions. / 请选择 10–120 个交易日。');const selected=rows.slice(start,end+1);if(Array.from(selected).some((r,i)=>!validCandle(r)||(i&&r.date<=selected[i-1].date)))throw Error('Invalid selected OHLCV or dates.');}
function neighborSet(sorted,length,horizon,k){const chosen=[];for(const c of sorted){if(chosen.every(p=>Math.abs(p.end-c.end)>=length+horizon))chosen.push(c);if(chosen.length===k)break;}return chosen;}
function stats(rows,candidates,h){const values=candidates.map(c=>100*Math.expm1(Math.log(rows[c.end+h].close)-Math.log(rows[c.end].close)));return {h,n:values.length,values,mean:values.length?mean(values):null,median:quantile(values,.5),positive:values.length?100*mean(values.map(x=>+(x>0))):null,p10:quantile(values,.1),p90:quantile(values,.9)};}
export function makeEngine(dataset,symbol){
 if(!dataset||!Array.isArray(dataset[symbol]))throw Error('Unknown symbol.');
 const rows=dataset[symbol],symbols=Object.keys(dataset).sort(),maps=new Map(symbols.map(s=>[s,new Map([...dataset[s]].reverse().filter(r=>r&&typeof r.date==='string').map(r=>[r.date,r]))])),cache=new Map();
 function basketFor(window){if(symbols.length<3||symbols.length>12)return null;const basket=symbols.map(s=>window.map(r=>maps.get(s).get(r.date)));return basket.every(series=>series.every(r=>validCandle(r)))?basket:null;}
 function topology(start,end){const key=start+':'+end;if(!cache.has(key)){if(cache.size>3000)cache.clear();const basket=basketFor(rows.slice(start,end+1));cache.set(key,basket?topologyEmbedding(basket,symbols):null);}return cache.get(key);}
 function analyze(start,end,ids=ANALYSIS_IDS){
  validateSelection(rows,start,end);if(!Array.isArray(ids)||ids.some(id=>!ANALYSIS_IDS.includes(id)))throw Error('Unknown current-analysis model.');
  const window=rows.slice(start,end+1),length=window.length,prior=start>=length?rows.slice(start-length,start):null,previous=prior&&Array.from(prior).every((r,i)=>validCandle(r)&&(!i||r.date>prior[i-1].date))?prior:null,basket=basketFor(window);
  return {mode:'analysis',start,end,length,symbol,models:analyzePeriod(window,rows.slice(0,end+1),basket,symbols,previous,previous?basketFor(previous):null,[...new Set(ids)]),basketSymbols:basket?symbols:[],previousPeriod:previous?{from:previous[0].date,to:previous.at(-1).date}:null};
 }
 function homology(start,end,k=8,{horizons=[5,20,60],stability=true,retrieval='topology'}={}){
  validateSelection(rows,start,end);if(!['topology','h0','h1','correlation'].includes(retrieval))throw Error('Unknown retrieval method.');if(!Number.isInteger(k)||k<1||k>20||!Array.isArray(horizons)||!horizons.length||horizons.some(h=>![5,20,60].includes(h)))throw Error('Invalid homology options.');
  const length=end-start+1,target=topology(start,end),base={mode:'homology',start,end,length,target,basketSymbols:target?.symbols||[],candidateCount:0,cohorts:[],stability:null};
  if(!target?.available){return {...base,evidence:status('insufficient',target?'Too little return variation for topology.':'Load 3–12 assets covering every selected date.',target?'资产收益变化不足，无法计算拓扑。':'请载入覆盖全部选中日期的 3–12 个资产。',target?'no-variation':'missing-basket')};}
  const compare=(a,b)=>{const full=topologyComparison(a,b);if(retrieval==='topology')return full;if(retrieval==='h0'||retrieval==='h1'){const k=retrieval==='h0'?0:1;return {...full,distance:Math.hypot(Math.sqrt(.7)*full.channels.linear[k],Math.sqrt(.3)*full.channels.rank[k])};}const dist=(x,y)=>{let sum=0,n=0;for(let i=0;i<x.length;i++)for(let j=i+1;j<x.length;j++){sum+=(x[i][j]-y[i][j])**2;n++;}return Math.sqrt(sum/n);};return {...full,distance:Math.hypot(Math.sqrt(.7)*dist(a.linearDistances,b.linearDistances),Math.sqrt(.3)*dist(a.rankDistances,b.rankDistances))};};
  const candidates=[];
  for(let e=length-1;e+Math.min(...horizons)<start;e+=5){const s=e-length+1,v=topology(s,e);if(!v?.available)continue;const c=compare(target,v);candidates.push({start:s,end:e,distance:c.distance,channels:c.channels,representation:v});}
  candidates.sort((a,b)=>a.distance-b.distance||a.end-b.end);base.candidateCount=candidates.length;
  const indistinguishable=candidates.length>1&&Math.abs(candidates.at(-1).distance-candidates[0].distance)<=1e-12*Math.max(1,candidates.at(-1).distance);
  // Resampling tests the query's sensitivity against each horizon's fixed local
  // shortlist. It is neither a full-bank bootstrap nor a confidence interval.
  const sampled=[];if(stability&&candidates.length&&!indistinguishable){const basket=basketFor(rows.slice(start,end+1));for(let i=0;i<8;i++){try{const v=topologyEmbedding(resampleBasket(basket,700+i),symbols);if(v.available)sampled.push(v);}catch{}}}
  base.cohorts=[...new Set(horizons)].map(h=>{
   const mature=candidates.filter(c=>c.end+h<start),eligible=mature.filter(c=>validCandle(rows[c.end+h])&&Number.isFinite(100*Math.expm1(Math.log(rows[c.end+h]?.close)-Math.log(rows[c.end].close)))),tied=eligible.length>1&&Math.abs(eligible.at(-1).distance-eligible[0].distance)<=1e-12*Math.max(1,eligible.at(-1).distance),matches=tied?[]:neighborSet(eligible,length,h,k),originalTop=matches[0],referenceSet=matches.slice(0,3),shortlist=[...eligible.slice(0,30)];
   for(const c of referenceSet)if(!shortlist.some(x=>x.end===c.end))shortlist.push(c);
   let retained=0,retainedReferences=0;for(const v of sampled){const ranked=shortlist.map(c=>({...c,distance:compare(v,c.representation).distance})).sort((a,b)=>a.distance-b.distance||a.end-b.end);const selected=neighborSet(ranked,length,h,3);if(selected.some(c=>c.end===originalTop?.end))retained++;retainedReferences+=referenceSet.filter(c=>selected.some(x=>x.end===c.end)).length;}
   const sensitivity=sampled.length&&referenceSet.length?{replicates:sampled.length,shortlistSize:shortlist.length,topReferenceRetention:retained/sampled.length,referenceSetRetention:referenceSet.length?retainedReferences/(sampled.length*referenceSet.length):null}:null;
   const evidence=!matches.length&&!tied?status('insufficient','No mature separated references are available.','没有完整的分隔历史参考区间。','no-references'):tied?status('insufficient','Historical distances cannot distinguish periods.','历史距离无法区分参考区间。','tied-references'):matches.length<3?status('limited',`Only ${matches.length} separated reference period(s); insufficient historical evidence.`,`仅 ${matches.length} 个分隔参考区间，历史对比证据不足。`,'few-references'):!stability?status('limited','Matching stability was not checked.','尚未检查匹配稳定性。','unchecked'):stability&&sampled.length<4?status('limited','Insufficient valid resamples to assess matching stability.','有效重采样不足，无法判断匹配稳定性。','resamples'):length<30?status('limited','Short topology window; historical structure estimates are uncertain.','拓扑窗口较短，历史结构估计不确定。','short-window'):target.clippedReturns.some(n=>n/(length-1)>.2)?status('limited','Many returns were clipped; topology depends on the robust transformation.','较多收益被截尾，拓扑受稳健变换影响。','clipped'):sensitivity&&(sensitivity.topReferenceRetention<.5||sensitivity.referenceSetRetention<.5)?status('limited','References are unstable under block resampling.','参考区间在分块重采样下不稳定。','unstable'):status('observed','Historical comparison available','可查看历史对比');
   const clean=matches.map(({representation,...c})=>c),outcome=stats(rows,clean,h);
   return {h,matches:clean,eligibleCount:eligible.length,excludedOutcomeCount:mature.length-eligible.length,outcome,sensitivity,evidence,divergent:outcome.values.some(x=>x>0)&&outcome.values.some(x=>x<0)};
  });
  base.evidence=base.cohorts.every(c=>c.evidence.code==='observed')?status('observed','Historical comparisons available','可查看历史对比'):status('limited','Read the evidence for each horizon.','请分别查看各观察期的证据。','horizon-specific');base.indistinguishable=indistinguishable;return base;
 }
 function find(start,end,ids=['topology'],k=8,horizon=20){if(!Array.isArray(ids)||ids.some(id=>id!=='topology')||!ids.length)throw Error('Only Homology supports historical retrieval.');return homology(start,end,k,{horizons:[horizon]});}
 return {rows,symbols:symbols.length>=3?symbols:[],analyze,homology,find,topology,basketFor};
}
export async function validateHomology(engine,onProgress=()=>{},{retrieval='topology'}={}){
 const rows=engine.rows,records=[],length=30,h=20;let attempted=0,excluded=0;
 for(let end=180;end+h<rows.length;end+=20){
  const start=end-length+1,r=engine.homology(start,end,6,{horizons:[h],stability:true,retrieval}),cohort=r.cohorts[0];attempted++;
  const past=[];for(let e=length-1;e+h<start;e+=length+h)past.push(100*Math.expm1(Math.log(rows[e+h].close)-Math.log(rows[e].close)));
  if(!cohort||cohort.evidence.code!=='observed'||cohort.matches.length<3||past.length<3){excluded++;onProgress(attempted);await new Promise(resolve=>setTimeout(resolve,0));continue;}
  const actual=100*Math.expm1(Math.log(rows[end+h].close)-Math.log(rows[end].close)),prediction=cohort.outcome.mean,baseline=mean(past);
  records.push({date:rows[end].date,actual,prediction,baseline,error:Math.abs(prediction-actual),baselineError:Math.abs(baseline-actual)});onProgress(attempted);await new Promise(resolve=>setTimeout(resolve,0));
 }
 return {mode:'lab',id:'topology',attempted,excluded,n:records.length,mae:records.length?mean(records.map(r=>r.error)):null,baseline:records.length?mean(records.map(r=>r.baselineError)):null,records,evidence:records.length<10?status('limited','Few scored origins; no reliable forecasting conclusion.','有效检验起点较少，无法形成可靠预测结论。','few-validation'):status('observed','Exploratory walk-forward results','探索性滚动检验结果','exploratory-validation')};
}
