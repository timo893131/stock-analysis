/* Close-based review of an existing paper position. */
(function(root){
'use strict';
const paper=typeof module==='undefined'?root.StockroomPaper:require('./paper.js');
const dayLength=86400;
const tradeDay=seconds=>Math.floor((seconds+8*3600)/dayLength);
const unavailable=reason=>({action:'unavailable',reason});

function review({quote,position,reserved=0,officialClose,now=Date.now()}){
 if(!position?.quantity)return unavailable('目前已沒有這檔持倉。');
 if(!quote||quote.demo!==false||quote.dataKind!=='daily'||quote.sync?.error||
    !Number.isFinite(quote.price)||quote.price<.01||!Number.isFinite(quote.asOf)||
    quote.asOf*1000>now||now-quote.asOf*1000>7*dayLength*1000){
  return unavailable('需要七天內有效的真實日收盤，才能判斷持倉趨勢。');
 }
 const date=paper.day(quote.asOf*1000);
 if(officialClose?.date>date)return unavailable('官方快照已更新至 '+officialClose.date+'，先補齊個股歷史再判斷。');
 if(officialClose?.date===date&&Math.abs(officialClose.price-quote.price)>.010001){
  return unavailable('同行情日的個股歷史與官方快照收盤價不同，請更新後再核對。');
 }
 const history=Array.isArray(quote.history)?quote.history.slice(-60):[];
 if(history.length<60)return unavailable('至少需要 60 個交易日的有效收盤，才能比較短中期趨勢。');
 const invalid=history.some((bar,index)=>!Number.isFinite(bar?.time)||!Number.isFinite(bar.close)||bar.close<=0||
  (index>0&&tradeDay(bar.time)<=tradeDay(history[index-1].time)));
 const last=history.at(-1);
 if(invalid||last.time!==quote.asOf||Math.abs(last.close-quote.price)>.010001||last.volume===0){
  return unavailable('收盤歷史不完整或最新一筆無成交，請更新資料後再判斷。');
 }

 const average=rows=>rows.reduce((sum,bar)=>sum+bar.close,0)/rows.length;
 const ma20=average(history.slice(-20));
 const ma60=average(history);
 const base=history.at(-21);
 const change=quote.price/base.close-1;
 const distance=quote.price/ma20-1;
 const weak=quote.price<=ma20*.99&&change<0;
 let action='watch',fraction=0;
 if(weak){
  action='reduce';
  fraction=quote.price<ma60&&ma20<ma60&&quote.price<=base.close*.95?.5:.25;
 }else if(quote.price>=ma20*1.01&&ma20>ma60&&change>0){
  action='hold';
 }

 // Existing sell orders count toward the planned reduction.
 const target=Math.floor(position.quantity*fraction);
 const sellable=Math.max(0,position.quantity-reserved);
 const shares=Math.min(Math.max(0,target-reserved),sellable,paper.maxQuantity);
 const proceeds=shares?paper.estimate({positions:{[quote.symbol]:position}},quote.symbol,'sell',shares,paper.executionPrice(quote,'sell'),now):null;
 return {action,fraction,date,source:quote.source||'個股日收盤',price:quote.price,ma20,ma60,distance,change,
  baseDate:paper.day(base.time*1000),basePrice:base.close,quantity:position.quantity,reserved,sellable,target,shares,proceeds};
}

const api={review};
if(typeof module==='undefined')root.StockroomHoldingReview=api;
else module.exports=api;
})(globalThis);
