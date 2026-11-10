/* Plain-language rules and virtual-budget helper. No model calls or buy advice. */
(function(root){
'use strict';
const D=typeof module!=='undefined'?require('./decision.js'):root.StockroomDecision;
function explain(q,now=Date.now()){
 const a=D.assess(q,now);
 if(!a.ready)return {ready:false,tone:'waiting',title:q?.demo?'先等真實資料':'先確認資料',meaning:q?.demo?'目前是示範價格，可以認識介面，但不能用來練習下單。':a.reason,next:'更新行情後，先確認股票名稱與資料日期。'};
 if(a.label==='暫緩追價')return {ready:true,tone:'careful',title:'先觀察，不急著追價',meaning:a.reason,next:'先看財報與消息；想練習時，只用自己設定的小額虛擬預算。'};
 if(a.label==='可列入小額研究')return {ready:true,tone:'research',title:'趨勢偏強，還要查是否合理',meaning:'近期價格與平均價格的排列偏強，但這不代表股價便宜，也不是上漲保證。',next:'先看財報，再記下研究理由；可以用小額虛擬委託練習。'};
 return {ready:true,tone:'waiting',title:'方向還不明顯，先放觀察清單',meaning:'價格與平均價格還沒有一起走強。先觀察也是一種選擇，不必每天買股票。',next:'先收藏這檔，下一次更新後再比較。'};
}
function budgetShares(cash,budget,limit,fee=.001425){
 if(![cash,budget,limit,fee].every(Number.isFinite)||cash<0||budget<=0||limit<=0||fee<0)throw Error('請先確認預算與委託價格。');
 const available=Math.min(cash,budget),shares=Math.max(0,Math.floor(available/(limit*(1+fee))));
 return {shares,reserved:Math.round(shares*limit*(1+fee)*100)/100,available};
}
function nextStep(account,seen){
 const pending=(account.orders||[]).filter(o=>o.status==='pending').length;
 if(pending)return {action:'portfolio',title:`你有 ${pending} 筆待成交練習`,text:'送出不代表成交。等待委託日之後第一筆交易日收盤，再更新行情查看結果。',button:'查看委託與理由'};
 if((account.trades||[]).length)return {action:'portfolio',title:'今天先回顧一次練習',text:'先看費用與損益，再對照原本的理由；一次賺賠不能證明策略有效。',button:'回顧我的練習'};
 if(seen)return {action:'resume',title:'接著理解剛才看的股票',text:'先確認日期，再看白話解讀；不確定時可以先收藏，不急著送委託。',button:'繼續看剛才的股票'};
 return {action:'market',title:'第一次使用？先認識一檔股票',text:'搜尋你熟悉的公司，先看資料日期與價格變化。全部使用虛擬資金練習。',button:'開始找一檔股票'};
}
const api={explain,budgetShares,nextStep};if(typeof module!=='undefined')module.exports=api;else root.StockroomCoach=api;
})(typeof globalThis!=='undefined'?globalThis:this);
