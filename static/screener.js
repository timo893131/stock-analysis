/* One-day market-wide screen shared by browser and Worker; no trend/valuation inference. */
(function(root){
'use strict';
const rules=Object.freeze({minVolume:1000000,minTurnover:30000000,minChange:-1,maxChange:3});
const leveraged=q=>q.kind==='etf'&&(/^00\d+[LR]\./.test(q.symbol)||/槓桿|反向|正[二2]|反[一1]|[12]倍/.test(q.name));
function screen(snapshot,now=Date.now()){
 const input=Array.isArray(snapshot?.quotes)?snapshot.quotes:[],markets=snapshot?.markets||{},rows=[],seen=new Set(),excluded={},today=new Date(now+8*3600000).toISOString().slice(0,10);
 const reject=k=>{excluded[k]=(excluded[k]||0)+1;},dateCache=new Map();
 const validDate=date=>{if(dateCache.has(date))return dateCache.get(date);const stamp=Date.parse(date+'T13:30:00+08:00'),valid=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(stamp)&&new Date(Date.parse(date+'T00:00:00Z')).toISOString().slice(0,10)===date&&date<=today&&stamp<=now&&now-stamp<=7*86400000;dateCache.set(date,valid);return valid;};
 const readyDates=Object.values(markets).filter(m=>m.status==='ready'&&/^\d{4}-\d{2}-\d{2}$/.test(m.tradeDate||'')).map(m=>m.tradeDate).sort();const latest=readyDates.at(-1);
 for(const q of input){
  if(!q||typeof q.symbol!=='string'||! /^(?:\d{4}|00\d{3,4}[A-Z]?)\.(?:TW|TWO)$/.test(q.symbol)||typeof q.name!=='string'||!q.name.trim()||!['上市','上櫃'].includes(q.market)||q.demo===true){reject('代碼或資料格式');continue;}
  if((q.market==='上市')!==q.symbol.endsWith('.TW')){reject('市場代碼不符');continue;}
  if(seen.has(q.symbol)){reject('重複代碼');continue;}seen.add(q.symbol);
  const market=q.market==='上市'?'twse':'tpex',meta=markets[market];
  if(meta?.status!=='ready'){reject('來源未更新');continue;}
  const date=q.tradeDate;
  if(!validDate(date)){reject('過期或日期異常');continue;}
  if(date!==latest||date!==meta.tradeDate){reject('行情日期不同');continue;}
  if(!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.change)||q.change<=-100||!Number.isFinite(q.volume)||q.volume<0){reject('缺少有效收盤價量');continue;}
  rows.push({symbol:q.symbol,name:q.name,market:q.market,kind:q.symbol.startsWith('00')?'etf':'stock',price:q.price,change:q.change,volume:q.volume,turnover:Number.isFinite(q.turnover)&&q.turnover>=0?q.turnover:null,tradeDate:date});
 }
 const blocked={};const candidates=rows.filter(q=>{let reason;if(leveraged(q))reason='槓桿／反向商品';else if(q.volume<rules.minVolume)reason='成交量不足';else if(q.turnover===null)reason='缺少成交金額';else if(q.turnover<rules.minTurnover)reason='成交金額不足';else if(q.change<rules.minChange||q.change>rules.maxChange)reason='當日漲跌超出範圍';if(reason){blocked[reason]=(blocked[reason]||0)+1;return false;}return true;}).sort((a,b)=>b.turnover-a.turnover||b.volume-a.volume||(a.symbol<b.symbol?-1:a.symbol>b.symbol?1:0));
 const up=rows.filter(q=>q.change>0).length,down=rows.filter(q=>q.change<0).length;
 const sourceComplete=rows.length>0&&['twse','tpex'].every(k=>markets[k]?.status==='ready'&&markets[k].tradeDate===latest&&input.some(q=>q.market===(k==='twse'?'上市':'上櫃')));
 return {total:input.length,valid:rows.length,rows,candidates,excluded,blocked,sourceComplete,tradeDate:latest||null,rules,
  breadth:{up,down,flat:rows.length-up-down},counts:{stock:rows.filter(q=>q.kind==='stock').length,etf:rows.filter(q=>q.kind==='etf').length},markets:{twse:rows.filter(q=>q.market==='上市').length,tpex:rows.filter(q=>q.market==='上櫃').length},candidateCounts:{stock:candidates.filter(q=>q.kind==='stock').length,etf:candidates.filter(q=>q.kind==='etf').length}};
}
function facts(result){return {scope:'官方全市場日收盤快照的價量初選。不是全市場歷史／財報逐檔分析，也不是買入推薦；單日漲跌不能推出中長期走向。漲跌家數含 ETF，不是大盤指數。來源不完整時只代表列出的有效範圍。',coverage:{total:result.total,valid:result.valid,sourceComplete:result.sourceComplete,tradeDate:result.tradeDate,markets:result.markets,counts:result.counts,excluded:result.excluded},breadth:result.breadth,rules:result.rules,candidateCounts:result.candidateCounts,shortlist:[...result.candidates.filter(q=>q.kind==='stock').slice(0,4),...result.candidates.filter(q=>q.kind==='etf').slice(0,4)]};}
const api={screen,facts,rules};if(typeof module!=='undefined')module.exports=api;else root.StockroomScreener=api;
})(globalThis);
