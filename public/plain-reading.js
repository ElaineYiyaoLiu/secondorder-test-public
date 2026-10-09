// Short explanations grounded in the calculated result, without a trade signal.
export function candleContext(candle,previous,volumeHistory,lang='en'){
 const t=(en,zh)=>lang==='zh'?zh:en;
 if(!previous)return t('There is no earlier close in this dataset for a daily comparison.','当前数据中没有前一天的收盘价，暂不能比较日涨跌。');
 const change=(candle.close/previous.close-1)*100;
 const direction=t(change>0?'up':change<0?'down':'unchanged',change>0?'上涨':change<0?'下跌':'持平');
 const price=t(`Compared with the previous close, it was ${direction}${change?` ${Math.abs(change).toFixed(2)}%`:''}.`,`与前一日收盘相比，${direction}${change?` ${Math.abs(change).toFixed(2)}%`:''}。`);
 if(!volumeHistory.length)return price;
 const average=volumeHistory.reduce((sum,r)=>sum+r.volume,0)/volumeHistory.length;
 return price+(average>0?t(` Volume was ${(candle.volume/average).toFixed(2)} times the average of the preceding ${volumeHistory.length} sessions.`,` 成交量为此前 ${volumeHistory.length} 个交易日均值的 ${(candle.volume/average).toFixed(2)} 倍。`):'');
}
export function plainReading(model,lang='en'){
 const t=(en,zh)=>lang==='zh'?zh:en;
 if(!model||model.evidence?.code==='insufficient'||!model.metrics?.length)return '';
 if(model.id==='euclidean')return t('A long upper wick means the close was below the day’s high; a long lower wick means it finished above the low. Compare the pattern across days rather than treating one candle as a trend.','上影线较长，表示收盘时已离开当天高点；下影线较长，表示收盘时已离开低点。结合多天的形态看，不要仅凭一根 K 线判断趋势。');
 if(model.id==='dtw')return model.stats?.efficiency>.55?t('The path was relatively direct: more of the daily movement carried through to the final price. The drawdown marks show how large a setback still occurred along the way.','这段走势相对直接，每天的变化较多累积成了最终涨跌。再看回撤标记，就能知道途中仍经历过多大的下跌。'):t('The final price change hides some back-and-forth movement. Read it alongside maximum drawdown to see the setback between an earlier closing peak and a later low.','首尾涨跌掩盖了中途的一些反复。结合最大回撤看，能知道从区间内此前的收盘高点到之后低点，曾经跌了多少。');
 if(model.id==='correlation')return t('Positive values mean the pair’s daily returns tended to move in the same direction; negative values mean opposite directions. Read the full matrix to see whether the pattern spans the group or is concentrated in a few pairs.','正值表示两项资产的日涨跌更常同向，负值表示更常反向。结合整张矩阵看，就能区分这种关系遍及整组资产，还是只集中在少数配对。');
 if(model.id==='riemannian')return t('Assets that fluctuate strongly or move with the group can contribute more risk even when their weights are equal. Compare the bars with overall daily volatility: a large risk share is not the same as a large expected return.','即使权重相同，波动较大、或更常随整组一起变化的资产，也可能贡献更多风险。把柱状图与整组日波动一起看；风险份额高，不表示预期收益高。');
 if(model.id==='wasserstein')return t('A wider histogram means daily changes were more spread out. Compare the two tail averages to see whether the larger moves were stronger on the loss side or the gain side; these averages describe the selected days.','直方图越分散，表示每日涨跌幅度的差异越大。对比两侧尾部均值，可以看出较大变化更偏向下跌还是上涨；它们描述的是选中区间内已经发生的涨跌。');
 if(model.id==='ultrametric')return t('Different directions across the rows can mean a recent move sits inside a different longer-term pattern. Read each row’s net change and volatility together, since the direction label alone leaves out the size of the movement.','不同尺度方向不一致，可能表示近期走势与较长时期的状态不同。把每一行的涨跌和波动一起看；仅看方向标签，会遗漏变化的幅度。');
 if(model.id==='signature')return t('The largest-volume day may fall before, on or after the highest close. The four segments show where price changed while trading activity differed; event order by itself does not explain what caused the move.','成交量最高的一天可能在最高收盘价之前、当天或之后。四个分段帮助你看清价格在哪一段发生变化、当时成交量怎样；事件先后本身不能说明涨跌原因。');
 return '';
}
export function homologyReading(cohort,horizon,lang='en'){
 const t=(en,zh)=>lang==='zh'?zh:en;
 if(!cohort?.matches.length)return '';
 return cohort.divergent?t(`Some similar periods later rose while others fell over ${horizon} trading days. The median summarizes those references; compare the spread of outcomes and matching stability before drawing a conclusion.`,`相似区间之后 ${horizon} 个交易日里，有些上涨，有些下跌。中位数只是这些参考区间的汇总；还要结合收益分散程度和匹配稳定性来理解。`):t(`The later returns belong to the matched historical periods, each observed over ${horizon} trading days. A small structure distance means asset relationships were closer, not that the price path or next return must repeat.`,`后续收益来自匹配到的历史区间，各自观察 ${horizon} 个交易日。结构距离较小，只表示当时的资产关系更接近，不表示价格路径或接下来的收益会重复。`);
}
