/* Local, fee-aware research plans. Inspired by Day Trader's budget/risk/exit workflow. */
(function(root){
'use strict';
const P=typeof module!=='undefined'?require('./paper.js'):root.StockroomPaper;
const symbolOK=s=>typeof s==='string'&&/^(?:\d{4}|00\d{3,4}[A-Z]?)\.(?:TW|TWO)$/.test(s);
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function inputs(x){
 const keys=['budget','maxLoss','entry','stop','target','positionPct','bufferPct','maxOrder','minRR'];
 const v=Object.fromEntries(keys.map(k=>[k,Number(x[k])]));
 if(keys.some(k=>x[k]===''||x[k]==null||!Number.isFinite(v[k])))throw Error('請填完預算、價格與風險條件，再試算。');
 if(v.budget<=0||v.budget>1e9||v.maxLoss<=0||v.maxLoss>v.budget||v.maxOrder<=0||v.maxOrder>1e9)throw Error('預算與單筆上限必須大於 0，可承受損失不能超過預算。');
 if(v.entry<=0||v.entry>1e7||v.stop<=0||v.stop>=v.entry||v.target<=v.entry||v.target>1e7)throw Error('買入計畫必須是：停損價低於買入價，目標價高於買入價。');
 if(v.positionPct<1||v.positionPct>100||v.bufferPct<0||v.bufferPct>95||v.minRR<.1||v.minRR>10)throw Error('請確認部位比例（1–100%）、保留現金（0–95%）與最低賺賠比（0.1–10）。');
 for(const k of ['entry','stop','target'])v[k]=round(v[k]);
 if(v.stop>=v.entry||v.target<=v.entry)throw Error('價格四捨五入後重疊，請拉開買入、停損與目標價格。');
 return v;
}
function calculate(raw,q,account,now=Date.now()){
 const x=inputs(raw);
 if(!q||!symbolOK(q.symbol)||q.demo!==false||q.dataKind!=='daily'||q.sync?.error||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.asOf)||q.asOf*1000>now||now-q.asOf*1000>7*86400000)throw Error('請先載入 7 天內、同步成功的真實日收盤行情。');
 const entry=Math.max(x.entry,q.price),tax=P.taxRate(q.symbol,now),entryCost=entry*(1+P.feeRate);
 const stopNet=x.stop*(1-P.slippage)*(1-P.feeRate-tax),targetNet=x.target*(1-P.slippage)*(1-P.feeRate-tax);
 const risk=entryCost-stopNet,reward=targetNet-entryCost,rr=reward/risk;
 if(reward<=0)throw Error('扣除費稅與滑價後，目標價已沒有正的試算價差，請重新檢查計畫。');
 const r=account?P.reserves(P.validate(account)):{cash:0,shares:{}};
 const available=account?Math.max(0,account.cash-r.cash):x.budget;
 const exposure=account?(account.positions[q.symbol]?.quantity||0)*entry+account.orders.filter(o=>o.status==='pending'&&o.side==='buy'&&o.symbol===q.symbol).reduce((n,o)=>n+o.quantity*o.limit,0):0;
 const caps={loss:Math.max(0,Math.floor(x.maxLoss/risk)),position:Math.max(0,Math.floor((x.budget*x.positionPct/100-exposure)/entryCost)),order:Math.max(0,Math.floor(x.maxOrder/entryCost)),cash:Math.max(0,Math.floor(Math.min(available,x.budget*(1-x.bufferPct/100))/entryCost))};
 const shares=Math.min(1000000,...Object.values(caps)),binding=Object.keys(caps).filter(k=>caps[k]===shares);
 const reasons=[];
 if(rr<x.minRR)reasons.push('費稅後賺賠比 '+rr.toFixed(2)+'，低於你設定的 '+x.minRR.toFixed(2)+'。');
 if(!shares)reasons.push('目前限制容不下 1 股；可先觀察，不必為了下單提高風險上限。');
 if(account?.orders.some(o=>o.symbol===q.symbol&&o.status==='pending'))reasons.push('這檔已有待成交委託，請先查看或取消原委託。');
 const reserved=round(shares*entryCost);
 // Settlement fees round per order. Keep the size inside every money limit after rounding.
 if(reserved>Math.min(x.maxOrder,available,x.budget*(1-x.bufferPct/100))+.001)reasons.push('四捨五入後超出資金限制，請減少股數再檢查。');
 return {inputs:x,symbol:q.symbol,name:q.name,quoteAt:q.asOf,referencePrice:q.price,referenceSource:q.source||'日收盤來源',sizingEntry:entry,shares,caps,binding,reserved,loss:round(shares*risk),reward:round(shares*reward),riskPerShare:risk,rr,allowed:reasons.length===0,reasons,available,exposure,tax,usesHigherReference:entry>x.entry};
}
function validateBook(book){
 if(!book||book.version!==1||!Array.isArray(book.items)||book.items.length>50)throw Error('計畫備份格式不符（上限 50 筆）。');
 const ids=new Set();
 for(const p of book.items){
  if(typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)||!symbolOK(p.symbol)||typeof p.name!=='string'||p.name.length>80||typeof p.source!=='string'||p.source.length>150||!Number.isFinite(p.createdAt)||p.createdAt<=0||!Number.isFinite(p.quoteAt)||p.quoteAt<=0||p.quoteAt*1000>p.createdAt||!Number.isFinite(p.referencePrice)||p.referencePrice<=0||!Number.isSafeInteger(p.shares)||p.shares<1||p.shares>1000000)throw Error('計畫紀錄內容不完整；未取代原本資料。');
  inputs(p.inputs);ids.add(p.id);
 }
 return book;
}
function record(book,result,id,now=Date.now()){
 validateBook(book);
 if(!result.allowed)throw Error('計畫尚未通過你的條件，不能保存為可練習計畫。');
 if(book.items.length>=50)throw Error('已達 50 筆計畫，請先備份並移除舊計畫。');
 if(now-result.quoteAt*1000>7*86400000||result.quoteAt*1000>now)throw Error('行情日期已變動，請重新試算。');
 const p={id,symbol:result.symbol,name:result.name,source:result.referenceSource,createdAt:now,quoteAt:result.quoteAt,referencePrice:result.referencePrice,shares:result.shares,inputs:structuredClone(result.inputs)};
 return validateBook({version:1,items:[p,...book.items]});
}
function observation(plan,q,now=Date.now()){
 if(!q||q.symbol!==plan.symbol||q.demo!==false||q.sync?.error||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.asOf)||q.asOf*1000>now||now-q.asOf*1000>7*86400000)return {state:'waiting',text:'等待可核對的真實收盤資料'};
 if(q.asOf<=plan.quoteAt||P.day(q.asOf*1000)<=P.day(plan.createdAt))return {state:'waiting',text:'等待記錄後的交易日收盤'};
 if(q.price<=plan.inputs.stop)return {state:'stop',text:'收盤低於或等於你設定的停損價，請人工回顧'};
 if(q.price>=plan.inputs.target)return {state:'target',text:'收盤高於或等於你設定的目標價，請人工回顧'};
 return {state:'watch',text:'收盤仍在你設定的觀察範圍'};
}
const api={inputs,calculate,validateBook,record,observation};
if(typeof module!=='undefined')module.exports=api;else root.StockroomPlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this);
