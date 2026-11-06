/* Research sorting rules, never AI output or return probabilities. */
(function(root){
'use strict';
const D=typeof module!=='undefined'?require('./decision.js'):root.StockroomDecision;
function rank(quotes,reports=[],now=Date.now()){
 const rows=[],excluded=[];
 for(const q of quotes){
  const a=D.assess(q,now);
  if(!a.ready){excluded.push(q.symbol);continue;}
  const trend=(q.price>a.ma20?20:0)+(a.ma20>a.ma60?20:0);
  const risk=(a.vol<=.08?20:a.vol<=.15?10:0)+(Math.abs(a.distance)<=.05?15:Math.abs(a.distance)<=.1?8:0);
  const financial=reports.find(r=>r.symbol===q.symbol),special=['etf','finance'].includes(q.sector);
  const metrics=['revenue_yoy','eps','operating_cash'].map(key=>{
   const m=financial?.metrics?.find(m=>m.key===key);
   const stamp=typeof m?.period==='string'?Date.parse(m.period.length===7?m.period+'-01':m.period):NaN;
   return m&&Number.isFinite(m.value)&&Number.isFinite(stamp)&&stamp<=now&&now-stamp<=(key==='revenue_yoy'?120:240)*86400000?m:null;
  });
  const known=special?0:metrics.filter(Boolean).length;
  const fundamental=special?0:metrics.reduce((n,m,i)=>n+(m&&m.value>0?[10,8,7][i]:0),0);
  const score=trend+risk+fundamental,limit=special?75:100;
  const eligible=a.label==='可列入小額研究'&&(special||known===3&&metrics.every(m=>m.value>0));
  rows.push({symbol:q.symbol,name:q.name,sector:q.sector,tradeDate:q.tradeDate,score,limit,trend,risk,fundamental,known,special,eligible,
   label:eligible?'優先研究':a.label==='暫緩追價'?'暫緩追價':'等待／補資料',reason:a.reason,
   financialNote:special?'ETF／金融業未納入一般企業財報評分':known<3?'財報缺漏或過期：不列入優先研究':metrics.every(m=>m.value>0)?'營收年增、EPS、營業現金流皆為正':'部分財報條件未達正值：先觀察',
   metrics:special?[]:metrics.filter(Boolean).map(m=>({label:m.label,value:m.value,period:m.period}))});
 }
 rows.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score/b.limit-a.score/a.limit||a.symbol.localeCompare(b.symbol));
 return {rows,excluded,up:rows.filter(r=>r.trend===40).length,total:rows.length};
}
const api={rank};if(typeof module!=='undefined')module.exports=api;else root.StockroomResearch=api;
})(typeof globalThis!=='undefined'?globalThis:this);
