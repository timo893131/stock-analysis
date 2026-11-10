/* Forward observation journal. Price change is never presented as trading profit. */
(function(root){
'use strict';
const symbolOK=s=>typeof s==='string'&&/^(?:\d{4}|00\d{3,4}[A-Z]?)\.(?:TW|TWO)$/.test(s);
const choices=['watch','research','avoid'];
const day=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const text=(s,max,empty=false)=>typeof s==='string'&&s.length<=max&&(empty||!!s.trim());
function fresh(){return {version:1,entries:[]};}
function validQuote(q,now=Date.now()){
 return q&&symbolOK(q.symbol)&&text(q.name,80)&&Number.isFinite(q.price)&&q.price>0&&dateOK(q.tradeDate)&&q.tradeDate<=day(now)&&now>=Date.parse(q.tradeDate+'T13:30:00+08:00')&&now-Date.parse(q.tradeDate+'T13:30:00+08:00')<7*86400000&&q.demo!==true&&(q.asOf==null||Number.isFinite(q.asOf)&&q.asOf*1000<=now)&&(q.demo===false||q.snapshotVerified===true)&&!q.sync?.error;
}
function validate(value,now=Date.now()){
 if(!value||value.version!==1||!Array.isArray(value.entries)||value.entries.length>100)throw Error('研究紀錄格式不符或超過 100 筆。');
 const ids=new Set();
 for(const e of value.entries){
  if(!e||!text(e.id,80)||ids.has(e.id)||!symbolOK(e.symbol)||!text(e.name,80)||!Number.isFinite(e.createdAt)||e.createdAt<=0||e.createdAt>now||!dateOK(e.baselineDate)||e.baselineDate>day(e.createdAt)||!Number.isFinite(e.price)||e.price<=0||!text(e.source,100)||!choices.includes(e.choice)||!text(e.note,500)||!text(e.question,500)||!text(e.review,1000,true))throw Error('研究紀錄欄位無效。');
  if(e.ai!==null&&(!e.ai||!text(e.ai.model,100)||!Number.isFinite(Date.parse(e.ai.generatedAt))||Date.parse(e.ai.generatedAt)>e.createdAt||!['summary','risks','checks'].every(k=>text(e.ai[k],1500))))throw Error('AI 依據格式無效。');
  ids.add(e.id);
 }
 return value;
}
function create(q,input,ai=null,now=Date.now()){
 if(!validQuote(q,now))throw Error('需要 7 天內、有收盤價的真實資料才能記錄；請先更新行情。');
 const evidence=ai&&Number.isFinite(q.asOf)&&ai.symbol===q.symbol&&ai.asOf===q.asOf&&ai.status==='ready'?{model:ai.model,generatedAt:ai.generatedAt,summary:ai.summary,risks:ai.risks,checks:ai.checks,action:ai.action||'insufficient',reason:ai.reason||''}:null;
 const entry={id:input.id,symbol:q.symbol,name:q.name,createdAt:now,baselineDate:q.tradeDate,price:q.price,source:q.source||'官方日收盤',choice:input.choice,note:input.note.trim(),question:input.question.trim(),review:'',ai:evidence};
 validate({version:1,entries:[entry]},now);return entry;
}
function add(journal,entry,now=Date.now()){
 validate(journal,now);if(journal.entries.length>=100)throw Error('已達 100 筆，請先備份並整理紀錄。');
 if(journal.entries.some(e=>e.id===entry.id))throw Error('這筆紀錄已存在。');
 return validate({version:1,entries:[entry,...journal.entries]},now);
}
function review(journal,id,note,now=Date.now()){
 validate(journal,now);if(!text(note,1000,true))throw Error('回顧文字最多 1,000 字。');
 return validate({...journal,entries:journal.entries.map(e=>e.id===id?{...e,review:note}:e)},now);
}
function compare(entry,quotes,now=Date.now()){
 const candidates=quotes.filter(q=>q.symbol===entry.symbol&&validQuote(q,now)&&q.tradeDate>entry.baselineDate&&Date.parse(q.tradeDate+'T13:30:00+08:00')>entry.createdAt&&Date.parse(q.tradeDate+'T13:30:00+08:00')<=now).sort((a,b)=>b.tradeDate.localeCompare(a.tradeDate));
 if(!candidates.length)return {ready:false,reason:'等待記錄之後的新收盤資料；未新增付費或逐檔查詢。'};
 const q=candidates[0];return {ready:true,price:q.price,tradeDate:q.tradeDate,change:(q.price/entry.price-1)*100,source:q.source};
}
function remove(journal,id,now=Date.now()){validate(journal,now);return {...journal,entries:journal.entries.filter(e=>e.id!==id)};}
function merge(current,incoming,now=Date.now()){
 validate(current,now);validate(incoming,now);const entries=[...current.entries];
 for(const e of incoming.entries){const old=entries.find(x=>x.id===e.id);if(old){if(JSON.stringify({...old,imported:undefined})!==JSON.stringify({...e,imported:undefined}))throw Error('同一編號內容不同，已停止匯入，原紀錄保留。');continue;}entries.push({...e,imported:true});}
 entries.sort((a,b)=>b.createdAt-a.createdAt);return validate({version:1,entries},now);
}
const api={fresh,validate,validQuote,create,add,review,compare,merge,remove};if(typeof module!=='undefined')module.exports=api;else root.StockroomJournal=api;
})(globalThis);
