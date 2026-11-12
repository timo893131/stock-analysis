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
  const fee=.001425,tax=q.symbol.startsWith('00')?.001:.003,entry=q.price*1.001,stop=q.price*(1-stopPct/100),exit=stop*.999;
  const costPerShare=entry*(1+fee),lossPerShare=costPerShare-exit*(1-fee-tax),riskBudget=budget*riskPct/100,cap=budget*capPct/100;
  const shares=Math.max(0,Math.floor(Math.min(riskBudget/lossPerShare,cap/costPerShare,budget/costPerShare)));
  return {shares,entry,stop,riskBudget,cap,cost:shares*costPerShare,loss:shares*lossPerShare};
 }
 function advice(q,ai,now=Date.now()){
  const valid=assess(q,now).ready&&ai?.symbol===q?.symbol&&ai.asOf===q?.asOf&&ai.status==='ready'&&Number.isFinite(Date.parse(ai.generatedAt))&&Date.parse(ai.generatedAt)<=now&&now-Date.parse(ai.generatedAt)<86400000;
  const actions={consider:'可考慮小額分批',wait:'先觀察，等待條件',avoid:'目前暫不建議買入',insufficient:'資料不足，暫不判斷'};
  if(!valid)return {action:'insufficient',label:'資料待更新，暫不判斷',reason:'需要同行情日且 24 小時內的 AI 報告與有效行情。'};
  if(!actions[ai.action]||typeof ai.reason!=='string'||!ai.reason.trim())return {action:'insufficient',label:'尚未提供買入判斷',reason:'這是舊版報告，可重新解析取得簡短結論。'};
  return {action:ai.action,label:actions[ai.action],reason:ai.reason.slice(0,180)};
 }
 function parseBudget(raw){
  const text=String(raw??'').normalize('NFKC').trim().replace(/^(?:NT\$|NTD|新臺幣|新台幣)\s*/i,'').replace(/元$/,'').trim();
  if(!/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)$/.test(text))throw Error('請輸入整數金額，例如 10000 或 10,000。');
  const value=Number(text.replace(/,/g,''));
  if(!Number.isSafeInteger(value)||value<1||value>1e9)throw Error('可用資金範圍為 1 至 1,000,000,000 元。');
  return value;
 }
 function cashPlan(q,budget,now=Date.now()){
  const P=typeof module!=='undefined'?require('./paper.js'):root.StockroomPaper;
  if(!q||q.demo!==false||q.dataKind!=='daily'||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.asOf)||q.asOf*1000>now||now-q.asOf*1000>7*86400000||q.sync?.error)throw Error('需要有效的真實日收盤，才能換算股數。');
  return P.amountShares(budget,P.executionPrice(q,'buy'));
 }
 function entryPlan(q,ai,budget,now=Date.now()){
  if(!Number.isFinite(budget)||budget<=0||budget>1e9)throw Error('請輸入有效預算。');
  const a=advice(q,ai,now);
  if(a.action!=='consider')return {shares:0,cost:0,reason:a.label+'：'+a.reason,allocationPct:0};
  const pct=ai.allocationPct;
  if(![5,10,20,25].includes(pct))return {shares:0,cost:0,allocationPct:null,reason:'這份 AI 未提供金額比例，請重新解析；手動金額換算仍可使用。'};
  const allocation=Math.floor(budget*pct/100);
  if(!allocation)return {shares:0,cost:0,allocationPct:pct,reason:'AI 的參考比例預算不足 1 元，先不買入。'};
  const r=cashPlan(q,allocation,now);
  return {...r,allocationPct:pct,allocation,reason:`AI 回覆的第一筆參考比例為 ${pct}%，以你輸入的預算換算；僅供研究，不限制自由練習。`};
 }
 const api={assess,size,advice,entryPlan,cashPlan,parseBudget};if(typeof module!=='undefined')module.exports=api;else root.StockroomDecision=api;
})(typeof globalThis!=='undefined'?globalThis:this);
