/* Explainable, deterministic position sizing; not a probability forecast. */
(function(root){
 'use strict';
 function assess(q,now=Date.now()){
  if(!q||q.demo||!Number.isFinite(q.asOf)||q.asOf*1000>now||now-q.asOf*1000>7*86400000||q.sync?.error)return {ready:false,label:'先確認資料',reason:'需要 7 天內且同步成功的真實行情；示範或過期資料不產生買入試算。'};
  const h=q.history?.map(x=>x.close)||[];
  if(h.length<60||h.some(x=>!Number.isFinite(x)||x<=0))return {ready:false,label:'資料不足',reason:'至少需要 60 筆有效收盤資料。'};
  const last=h.at(-1),ma20=h.slice(-20).reduce((a,b)=>a+b)/20,ma60=h.slice(-60).reduce((a,b)=>a+b)/60;
  const returns=h.slice(-21).slice(1).map((x,i)=>Math.log(x/h.slice(-21)[i])),mean=returns.reduce((a,b)=>a+b)/returns.length;
  const vol=Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/returns.length)*Math.sqrt(20);
  const distance=last/ma20-1;
  const label=vol>.15||distance>.10?'暫緩追價':last>ma20&&ma20>ma60?'可列入小額研究':'先觀察';
  const reason=vol>.15?'近期波動較大，先縮小研究範圍與單次風險。':distance>.10?'價格距離 20 日均線超過 10%，留意追高後的回落風險。':label==='可列入小額研究'?'價格高於 20 日均線，且 20 日均線高於 60 日均線；只是趨勢條件，尚不能判斷估值是否便宜。':'尚未同時符合價格與中短期均線排列條件，可以先等待並核對基本面。';
  return {ready:true,label,reason,ma20,ma60,vol,distance};
 }
 function size(q,input){
  const {budget,riskPct,stopPct,capPct}=input;
  if(!Number.isFinite(q.price)||q.price<=0||![budget,riskPct,stopPct,capPct].every(Number.isFinite)||budget<=0||budget>1e9||riskPct<=0||riskPct>5||stopPct<1||stopPct>50||capPct<=0||capPct>100)throw Error('請填入有效資金；單筆風險 0–5%、停損距離 1–50%、部位上限 0–100%。');
  const fee=.001425,tax=q.symbol==='0050.TW'?.001:.003,entry=q.price*1.001,stop=q.price*(1-stopPct/100),exit=stop*.999;
  const costPerShare=entry*(1+fee),lossPerShare=costPerShare-exit*(1-fee-tax),riskBudget=budget*riskPct/100,cap=budget*capPct/100;
  const shares=Math.max(0,Math.floor(Math.min(riskBudget/lossPerShare,cap/costPerShare,budget/costPerShare)));
  return {shares,entry,stop,riskBudget,cap,cost:shares*costPerShare,loss:shares*lossPerShare};
 }
 const api={assess,size};if(typeof module!=='undefined')module.exports=api;else root.StockroomDecision=api;
})(typeof globalThis!=='undefined'?globalThis:this);
