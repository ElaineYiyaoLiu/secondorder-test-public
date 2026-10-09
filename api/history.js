// Reuse the original Stock adapter and its cache. This project stores no provider credential.
export const config={maxDuration:60};
export default async function history(req,res){
 const symbol=String(req.query?.symbol||'NVDA').toUpperCase(),years=String(req.query?.years||'3'),basket=String(req.query?.basket??'1');
 if(!/^[A-Z0-9.^-]{1,16}$/.test(symbol)||!['1','3','5','10'].includes(years)||!['0','1'].includes(basket))return res.status(400).json({error:'Invalid history request.',code:'invalid-request'});
 const url=new URL('https://secondorder-stock-public.vercel.app/api/history');url.search=new URLSearchParams({symbol,years,basket}).toString();
 try{
  const upstream=await fetch(url,{signal:AbortSignal.timeout(55000)}),data=await upstream.json();
  if(!upstream.ok){res.setHeader('Cache-Control','no-store');return res.status(upstream.status).json(data);}
  if(data.source!=='marketstack'||!data.dataset)throw Error('Unexpected history response.');
  res.setHeader('Cache-Control','public, s-maxage=21600');return res.status(200).json({...data,via:'stock.secondorder.tools'});
 }catch(error){res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'Market history could not be loaded. Retry or import an aligned CSV.',code:error.name==='TimeoutError'?'provider-timeout':'provider-unavailable'});}
}
