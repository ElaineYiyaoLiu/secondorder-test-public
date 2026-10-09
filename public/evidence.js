// Presentation does not change numerical eligibility or forecasting abstention.
const labels={descriptive:['Descriptive result','描述性结果'],sample:['Small sample','样本偏少'],unstable:['Unstable result','结果不稳定'],data:['Insufficient data','数据不足'],information:['Insufficient information','信息不足'],unchecked:['Stability unchecked','稳定性未检验'],sensitive:['Transformation sensitive','受数据处理影响'],limited:['Interpret cautiously','谨慎解读']};
const rules={
 'short-window':['sample','Compare a longer window, such as 30 or 60 sessions; this changes the period being described.','可比较 30 或 60 个交易日的较长区间；这会改变所描述的时期。'],
 'few-tails':['sample','Try 60 sessions to include more tail observations. This does not establish predictive accuracy.','可尝试 60 个交易日以增加尾部观测；这不代表预测更准确。'],
 'unstable':['unstable','Compare neighboring periods. More sessions do not guarantee a stable result.','可对比邻近区间；增加天数不保证结果稳定。'],
 'boundary':['unstable','The state is close to a threshold. Compare neighboring end dates; a longer selection alone may not change it.','状态接近分类阈值。可对比邻近结束日期；单纯扩大选区未必改变状态。'],
 'no-variation':['information','Check the input data or compare another period. Adding similar observations may not help.','检查输入数据或对比其他时期；增加同类观测未必有帮助。'],
 'low-variation':['information','Compare another end date and check price variation. The fixed classification floor still applies.','可对比其他结束日期并检查价格变化；固定分类下限仍适用。'],
 'prior-dominated':['information','The data do not distinguish specific relationships reliably. Compare another period or asset group.','当前数据难以可靠区分具体资产关系。可对比其他时期或资产组。'],
 'missing-volume':['data','Load complete volume data for the selected dates. Increasing the window does not fill missing values.','补齐选中日期的成交量数据；增加天数不会补齐缺失值。'],
 'missing-basket':['data','Load 3–12 assets with all selected dates covered.','载入 3–12 个资产，并确保覆盖全部选中日期。'],
 'history-scales':['data','Load more history before the end date, or choose a later end date. Changing selection length alone does not add history.','补充结束日期之前的历史，或选择更晚的结束日期；改变选区天数不会增加历史数据。'],
 'numeric-range':['data','Check unusually large input values before rerunning.','检查异常大的输入值后重新运行。'],
 'resamples':['unchecked','The stability check had too few usable samples. Compare another period or asset group.','稳定性检验的有效样本不足。可对比其他时期或资产组。'],
 'unchecked':['unchecked','Run with the matching stability check enabled.','启用匹配稳定性检验后重新运行。'],
 'clipped':['sensitive','Inspect extreme returns and compare the raw data. More sessions do not remove this transformation.','检查极端收益并对照原始数据；增加天数不会取消该处理。'],
 'few-references':['sample','Load more earlier history. A longer query can reduce the number of separated references.','可补充更早历史；加长查询区间可能减少分隔参考数。'],
 'no-references':['data','Load more earlier history with completed later outcomes, or compare a shorter query.','补充具有完整后续结果的更早历史，或对比更短的查询区间。'],
 'tied-references':['information','These distances do not separate past periods. Compare another period or asset group.','当前距离无法区分过去区间。可对比其他时期或资产组。'],
 'few-validation':['sample','More past-only scored origins are needed. Increasing the analysis window alone does not ensure more valid tests.','需要更多仅使用过去数据的有效检验起点；加长分析区间不保证增加有效检验数。'],
 'horizon-specific':['limited','Read the status for the selected outcome horizon.','查看所选后续观察期的状态。']
};
export function presentEvidence(e,{id}={}){
 if(!e)return {code:'not-run',displayCode:'not-run',en:'Not run',zh:'尚未运行',detailEn:'',detailZh:'',actionEn:'',actionZh:'',methodEn:'',methodZh:''};
 const descriptive=e.code==='observed'||e.reason==='exploratory';
 const rule=rules[e.reason];const displayCode=descriptive?'descriptive':rule?.[0]||(e.code==='insufficient'?'data':'limited');
 const scoped=e.reason==='boundary'?['Near state boundary','接近状态边界']:e.reason==='unstable'?({correlation:['Sensitive asset links','资产关联敏感'],riemannian:['Sensitive risk shares','风险份额敏感'],topology:['Sensitive historical matches','历史匹配敏感']}[id]):null;
 const [en,zh]=scoped||labels[displayCode];
 return {code:e.code,reason:e.reason,displayCode,en,zh,detailEn:descriptive?'':e.en,detailZh:descriptive?'':e.zh,actionEn:descriptive?'':rule?.[1]||'',actionZh:descriptive?'':rule?.[2]||'',methodEn:id==='signature'?'Exploratory method: event order and signed areas do not establish causality.':e.reason==='exploratory-validation'?'Exploratory validation does not establish future forecasting accuracy.':'',methodZh:id==='signature'?'探索性方法：事件顺序和有向面积不证明因果关系。':e.reason==='exploratory-validation'?'探索性检验不证明未来预测准确性。':''};
}
export function geometryEvidence(g,analysis){return presentEvidence(analysis?.models?.find(m=>m.id===g.id)?.evidence,{id:g.id});}
