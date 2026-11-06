/* Local-only next-session close simulation. Deterministic, no broker integration. */
(function(root){
 'use strict';
 const SYMBOLS=['2330.TW','2317.TW','2454.TW','2308.TW','2881.TW','0050.TW'];
 const feeRate=.001425,slippage=.001;
 const round=n=>Math.round(n*100+1e-8)/100;
 const day=time=>new Date(time).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
 const fresh=()=>({version:2,initial:1000000,cash:1000000,realized:0,positions:{},orders:[],trades:[]});
 const taxRate=s=>s==='0050.TW'?.001:.003;
 function reserves(a){let cash=0;const shares={};for(const o of a.orders.filter(o=>o.status==='pending')){if(o.side==='buy')cash+=round(o.limit*o.quantity*(1+feeRate));else shares[o.symbol]=(shares[o.symbol]||0)+o.quantity;}return {cash:round(cash),shares};}
 function validate(a){
  if(!a||a.version!==2||a.initial!==1000000||!Number.isFinite(a.cash)||a.cash<0||!Number.isFinite(a.realized)||!a.positions||Array.isArray(a.positions)||!Array.isArray(a.orders)||!Array.isArray(a.trades)||a.orders.length>2000||a.trades.length>2000)throw Error('練習帳戶資料格式不符。');
  for(const [symbol,p] of Object.entries(a.positions))if(!SYMBOLS.includes(symbol)||!Number.isSafeInteger(p.quantity)||p.quantity<=0||!Number.isFinite(p.cost)||p.cost<0)throw Error('持倉資料格式不符。');
  const ids=new Set();for(const o of a.orders){if(typeof o.id!=='string'||o.id.length>100||ids.has(o.id)||!SYMBOLS.includes(o.symbol)||!['buy','sell'].includes(o.side)||!Number.isSafeInteger(o.quantity)||o.quantity<=0||o.quantity>1000000||!Number.isFinite(o.limit)||o.limit<=0||!Number.isFinite(o.createdAt)||!Number.isFinite(o.referenceTime)||o.referenceTime<=0||!['pending','filled','cancelled','expired'].includes(o.status)||typeof o.note!=='string'||o.note.length>500||typeof o.name!=='string'||o.name.length>80)throw Error('委託資料格式不符。');ids.add(o.id);}
  for(const t of a.trades)if(!ids.has(t.orderId)||!SYMBOLS.includes(t.symbol)||!['buy','sell'].includes(t.side)||!Number.isSafeInteger(t.quantity)||t.quantity<=0||![t.price,t.fee,t.tax,t.time].every(Number.isFinite)||t.price<=0||t.fee<0||t.tax<0||typeof t.name!=='string'||t.name.length>80)throw Error('成交紀錄格式不符。');
  const r=reserves(a);if(r.cash>a.cash+.01||Object.entries(r.shares).some(([s,n])=>n>(a.positions[s]?.quantity||0)))throw Error('預留資金或股數超過可用餘額。');
  return a;
 }
 function place(account,q,input,now=Date.now()){
  validate(account);
  if(!q||q.demo!==false||q.dataKind!=='daily'||!SYMBOLS.includes(q.symbol)||!Number.isFinite(q.asOf)||q.asOf*1000>now||now-q.asOf*1000>7*86400000||q.sync?.error)throw Error('請先取得 7 天內、同步成功的真實收盤行情。休市過久時請等待新資料。');
  const {side,quantity,id,note=''}=input;const limit=round(input.limit);
  if(!['buy','sell'].includes(side)||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000||!Number.isFinite(limit)||limit<.01||limit>10000000||typeof id!=='string'||!id||typeof note!=='string'||note.length>500)throw Error('請輸入有效的股數、價格與練習理由。');
  if(account.orders.some(o=>o.id===id))throw Error('委託編號已存在。');
  if(account.orders.some(o=>o.symbol===q.symbol&&o.status==='pending'))throw Error('同一檔股票已有待成交委託，請先取消或等待結算。');
  if(account.orders.length>=2000)throw Error('已達 2,000 筆委託上限，請先匯出備份。');
  const a=structuredClone(account),r=reserves(a),cap=round(limit*quantity*(1+feeRate));
  if(side==='buy'&&cap>a.cash-r.cash+.001)throw Error('預留資金不足，請減少股數或最高買價。');
  if(side==='sell'&&quantity>(a.positions[q.symbol]?.quantity||0)-(r.shares[q.symbol]||0))throw Error('可賣股數不足；練習不提供放空或借券。');
  a.orders.unshift({id,symbol:q.symbol,name:q.name,side,quantity,limit:round(limit),note,createdAt:now,referenceTime:q.asOf,status:'pending'});
  return validate(a);
 }
 function cancel(account,id){const a=structuredClone(validate(account)),o=a.orders.find(x=>x.id===id);if(!o||o.status!=='pending')throw Error('只能取消尚未成交的委託。');o.status='cancelled';return a;}
 function settle(account,quotes,now=Date.now()){
  const a=structuredClone(validate(account));
  // Stable chronological processing; duplicate refreshes cannot re-execute completed orders.
  for(const o of [...a.orders].filter(x=>x.status==='pending').sort((x,y)=>x.createdAt-y.createdAt)){
   const q=quotes.find(q=>q.symbol===o.symbol);
   if(!q||q.demo!==false||q.sync?.error||!Array.isArray(q.history)||!q.history.length)continue;
   const h=q.history;
   if(h.some((x,i)=>!Number.isFinite(x.time)||!Number.isFinite(x.close)||x.close<=0||i>0&&x.time<=h[i-1].time))continue;
   if(h[0].time>o.referenceTime){o.status='expired';o.message='資料窗口已不含委託時行情，無法確認首次交易日；未成交。';continue;}
   const cut=Math.max(o.createdAt,o.referenceTime*1000);
   const bar=h.find(x=>day(x.time*1000)>day(cut)&&x.time*1000<=now);
   if(!bar)continue;
   const price=round(bar.close*(o.side==='buy'?1+slippage:1-slippage));
   if(price<=0||o.side==='buy'&&price>o.limit||o.side==='sell'&&price<o.limit){o.status='expired';o.message='下一交易日收盤未符合設定價格，本次委託未成交。';continue;}
   const gross=round(price*o.quantity),fee=round(gross*feeRate),tax=o.side==='sell'?round(gross*taxRate(o.symbol)):0;
   const p=a.positions[o.symbol]||{quantity:0,cost:0};let pnl=null;
   if(o.side==='buy'){
    if(gross+fee>a.cash+.001){o.status='expired';o.message='結算時資金不足，未成交。';continue;}
    a.cash=round(a.cash-gross-fee);p.quantity+=o.quantity;p.cost=round(p.cost+gross+fee);a.positions[o.symbol]=p;
   }else{
    if(p.quantity<o.quantity){o.status='expired';o.message='結算時持股不足，未成交。';continue;}
    const cost=round(p.cost/p.quantity*o.quantity);pnl=round(gross-fee-tax-cost);
    a.cash=round(a.cash+gross-fee-tax);a.realized=round(a.realized+pnl);p.quantity-=o.quantity;p.cost=round(p.cost-cost);
    if(p.quantity)a.positions[o.symbol]=p;else delete a.positions[o.symbol];
   }
   o.status='filled';o.filledAt=bar.time*1000;
   a.trades.unshift({orderId:o.id,symbol:o.symbol,name:o.name,side:o.side,quantity:o.quantity,price,fee,tax,pnl,time:bar.time*1000});
  }
  return validate(a);
 }
 const api={fresh,validate,reserves,place,cancel,settle,feeRate,slippage,taxRate,day};
 if(typeof module!=='undefined')module.exports=api;else root.StockroomPaper=api;
})(typeof globalThis!=='undefined'?globalThis:this);
