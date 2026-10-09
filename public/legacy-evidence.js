// Display evidence separately from whether a distance calculation completed.
const result=(code,en,zh,detailEn,detailZh,showMatches=false)=>({code,en,zh,detailEn,detailZh,showMatches});
export function geometryEvidence(g,search,basketCount){
 if(g.basket&&basketCount<3)return result('basket','Insufficient data','数据不足','Load 3–12 assets with matching dates.','请导入日期对齐的 3–12 个资产。');
 if(!search||![...search.active,...(search.skipped||[])].includes(g.id))return result('not-run','Not run','尚未运行','Run this method to check the selected period.','运行后检查当前区间。');
 const target=search.target,representation=target[g.id];
 const state=g.id==='correlation'?target.relationship:g.id==='riemannian'?target.marketState:g.id==='topology'?target.topologyState:null;
 if(state?.available===false)return result('variation','Insufficient evidence','证据不足','An asset has too little return variation; use another dataset or method.','资产收益变化不足；请换数据或使用其他模型。');
 if(g.id==='correlation'&&target.relationshipInformative===false)return result('unsuitable','Unsuitable for these data','当前数据不适合','Relationships collapse to the prior; change the asset basket or use another model.','关系完全收缩，无法区分历史；请换资产组或使用其他模型。');
 if(!representation)return result('alignment','Insufficient data','数据不足','Asset dates do not align in this period; import aligned data.','当前区间的资产日期不一致；请导入对齐数据。');
 const info=search.methodEvidence?.[g.id],references=search.rankings[g.id]||[];
 if(info?.indistinguishable)return result('ties','Insufficient distinction','区分证据不足','All historical distances are tied; change the dataset or method.','历史距离全部相同，无法排序；请换数据或模型。');
 if(!(search.methodCandidateCount?.[g.id]>0)||!references.length)return result('history','Insufficient history','历史证据不足','No eligible earlier periods; import more history or choose a later query.','没有合格历史区间；请导入更长历史或选择更晚的查询。');
 if(references.length<3)return result('few','Limited historical evidence','历史证据不足',`Only ${references.length} independent reference period(s), insufficient for a conclusion; import more history.`,`仅 ${references.length} 个独立参考区间，证据不足；请导入更长历史。`,true);
 if(g.id==='riemannian'&&state?.shrinkage===1)return result('structure','Limited structure evidence','结构证据不足','Overall risk can be compared; asset relationships cannot be distinguished.','可比较整体风险，资产关系结构证据不足。',true);
 const zeroVolume=g.id==='euclidean'?target.candle?.zeroVolumeCount:g.id==='ultrametric'?representation.summary?.zeroVolumeCount:g.id==='signature'?representation.summary?.zeroVolumeCount:0;
 if(zeroVolume>=search.length)return result('volume','Limited volume evidence','成交量证据不足','Volume is missing throughout; results mainly describe price shape.','全段成交量为零，结果主要反映价格形态。',true);
 return result('calculated','Calculated','已计算','','',true);
}

