const equities = [
['NVDA','NVIDIA','英伟达'],['AAPL','Apple','苹果'],['TSLA','Tesla','特斯拉'],['MSFT','Microsoft','微软'],['AMZN','Amazon','亚马逊'],['META','Meta Platforms','Meta'],
['GOOGL','Alphabet Class A','谷歌 A'],['GOOG','Alphabet Class C','谷歌 C'],['AVGO','Broadcom','博通'],['AMD','Advanced Micro Devices','超微半导体'],
['INTC','Intel','英特尔'],['QCOM','Qualcomm','高通'],['MU','Micron Technology','美光'],['AMAT','Applied Materials','应用材料'],['LRCX','Lam Research','泛林集团'],
['KLAC','KLA','科磊'],['TXN','Texas Instruments','德州仪器'],['ADI','Analog Devices','亚德诺'],['ARM','Arm Holdings','安谋'],['TSM','Taiwan Semiconductor','台积电'],
['ASML','ASML Holding','阿斯麦'],['ORCL','Oracle','甲骨文'],['CRM','Salesforce','赛富时'],['ADBE','Adobe','奥多比'],['NOW','ServiceNow','ServiceNow'],
['PLTR','Palantir Technologies','帕兰提尔'],['PANW','Palo Alto Networks','派拓网络'],['CRWD','CrowdStrike','CrowdStrike'],['FTNT','Fortinet','飞塔'],['SNOW','Snowflake','Snowflake'],
['NET','Cloudflare','Cloudflare'],['DDOG','Datadog','Datadog'],['MDB','MongoDB','MongoDB'],['SHOP','Shopify','Shopify'],['UBER','Uber Technologies','优步'],
['ABNB','Airbnb','爱彼迎'],['DASH','DoorDash','DoorDash'],['PYPL','PayPal','贝宝'],['COIN','Coinbase Global','Coinbase'],['HOOD','Robinhood Markets','Robinhood'],
['NFLX','Netflix','奈飞'],['DIS','Walt Disney','迪士尼'],['SPOT','Spotify Technology','声田'],['ROKU','Roku','Roku'],['EA','Electronic Arts','艺电'],
['TTWO','Take-Two Interactive','Take-Two'],['RBLX','Roblox','Roblox'],['WMT','Walmart','沃尔玛'],['COST','Costco Wholesale','好市多'],['TGT','Target','塔吉特'],
['HD','Home Depot','家得宝'],['LOW','Lowe’s Companies','劳氏'],['NKE','Nike','耐克'],['SBUX','Starbucks','星巴克'],['MCD','McDonald’s','麦当劳'],
['CMG','Chipotle Mexican Grill','Chipotle'],['KO','Coca-Cola','可口可乐'],['PEP','PepsiCo','百事'],['PG','Procter & Gamble','宝洁'],['CL','Colgate-Palmolive','高露洁'],
['JPM','JPMorgan Chase','摩根大通'],['BAC','Bank of America','美国银行'],['WFC','Wells Fargo','富国银行'],['C','Citigroup','花旗'],['GS','Goldman Sachs','高盛'],
['MS','Morgan Stanley','摩根士丹利'],['BLK','BlackRock','贝莱德'],['SCHW','Charles Schwab','嘉信理财'],['V','Visa','维萨'],['MA','Mastercard','万事达'],
['AXP','American Express','美国运通'],['BRK.B','Berkshire Hathaway Class B','伯克希尔 B'],['UNH','UnitedHealth Group','联合健康'],['JNJ','Johnson & Johnson','强生'],['LLY','Eli Lilly','礼来'],
['ABBV','AbbVie','艾伯维'],['MRK','Merck','默沙东'],['PFE','Pfizer','辉瑞'],['AMGN','Amgen','安进'],['GILD','Gilead Sciences','吉利德'],
['ISRG','Intuitive Surgical','直觉外科'],['TMO','Thermo Fisher Scientific','赛默飞'],['ABT','Abbott Laboratories','雅培'],['CVS','CVS Health','CVS'],['XOM','Exxon Mobil','埃克森美孚'],
['CVX','Chevron','雪佛龙'],['COP','ConocoPhillips','康菲'],['SLB','SLB','斯伦贝谢'],['OXY','Occidental Petroleum','西方石油'],['CAT','Caterpillar','卡特彼勒'],
['DE','Deere & Company','迪尔'],['BA','Boeing','波音'],['GE','GE Aerospace','通用航空'],['HON','Honeywell','霍尼韦尔'],['RTX','RTX','雷神技术'],
['LMT','Lockheed Martin','洛克希德马丁'],['UPS','United Parcel Service','联合包裹'],['FDX','FedEx','联邦快递'],['NEE','NextEra Energy','新纪元能源'],['PLD','Prologis','普洛斯'],
];
export const stocks = [...equities.slice(0,6),['SPY','SPDR S&P 500 ETF','标普 500 ETF'],['QQQ','Invesco QQQ ETF','纳斯达克 100 ETF'],...equities.slice(6)].map(([symbol,name,zh])=>({symbol,name,zh}));
export function demoCandles(symbol, count=500) {
  const index=stocks.findIndex(s=>s.symbol===symbol);
  let seed=173+index*41; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const bases=[132,208,268,423,183,571,562,482]; const vols=[140e6,48e6,87e6,23e6,37e6,17e6,49e6,32e6];
  let price=bases[index]??(50+(index*37)%450); const out=[];
  for(let d=new Date('2023-07-03T12:00:00Z');out.length<500;d.setUTCDate(d.getUTCDate()+1)) {
    if([0,6].includes(d.getUTCDay()) || ['2023-07-04','2023-09-04','2023-11-23','2023-12-25','2024-01-01','2024-01-15','2024-02-19','2024-03-29','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-11-28','2024-12-25','2025-01-01','2025-01-09','2025-01-20','2025-02-17','2025-04-18','2025-05-26','2025-06-19'].includes(d.toISOString().slice(0,10)))continue;
    const i=out.length%126, open=price*(1+(random()-.5)*.014), drift=i<40?.0015:i<65?-.003:i<106?.0028:-.0007;
    const close=open*(1+drift+(random()-.5)*.031), high=Math.max(open,close)*(1+random()*.016),low=Math.min(open,close)*(1-random()*.014);
    out.push({date:d.toISOString().slice(0,10),open,high,low,close,volume:Math.round((vols[index]??(12+index%23)*1e6)*(.55+random()))});price=close;
  }
  if(count<=500)return out.slice(0,count);
  // Additional demo history goes before the fixture, never into future dates.
  const dates=[],d=new Date(out[0].date+'T12:00:00Z');
  while(dates.length<count-500){d.setUTCDate(d.getUTCDate()-1);if(![0,6].includes(d.getUTCDay()))dates.push(d.toISOString().slice(0,10));}
  price=out[0].open;const prefix=dates.reverse().map((date,i)=>{const open=price*(1+(random()-.5)*.014),close=open*(1+.001*Math.sin(i/21)+(random()-.5)*.031),high=Math.max(open,close)*(1+random()*.016),low=Math.min(open,close)*(1-random()*.014);price=close;return {date,open,high,low,close,volume:Math.round((vols[index]??12e6)*(.55+random()))};});
  const scale=out[0].open/prefix.at(-1).close;
  prefix.forEach(r=>{for(const k of ['open','high','low','close'])r[k]*=scale;});
  return [...prefix,...out];
}

export function candleTranslation(c, lang) {
  const range=c.high-c.low;
  if(!range)return lang==='zh'?'这一天价格没有变化。':'The price stayed the same throughout the session.';
  const upper=(c.high-Math.max(c.open,c.close))/range,lower=(Math.min(c.open,c.close)-c.low)/range,body=Math.abs(c.close-c.open)/range,position=(c.close-c.low)/range;
  if(body<.15)return lang==='zh'?'盘中虽然有涨有跌，收盘还是回到了开盘附近，全天变化不大。':'Prices moved during the session, but finished close to where they opened.';
  if(upper>.45)return lang==='zh'?'盘中一度涨得更高，但收盘时回落了，没能守住高位。':'The price reached higher levels during the session, then gave back some of that move before the close.';
  if(lower>.45)return lang==='zh'?'盘中一度跌得更低，后来有所回升，收盘明显高于当天最低价。':'The price traded lower during the session, then recovered to finish well above the low.';
  if(c.close>c.open)return lang==='zh'?(position>.75?'收盘比开盘高，而且接近当天最高价，涨幅大部分保留到了收盘。':'收盘比开盘高，但离当天最高价还有一段距离。'):(position>.75?'The price finished above the open and near the day’s high, holding on to most of its gains.':'The price finished above the open, though below the day’s high.');
  return lang==='zh'?(position<.25?'收盘比开盘低，而且接近当天最低价，到收盘时也没有明显回升。':'收盘比开盘低，不过已经从当天最低价有所回升。'):(position<.25?'The price finished below the open and near the day’s low, with little recovery by the close.':'The price finished below the open, but recovered some ground from the day’s low.');
}
