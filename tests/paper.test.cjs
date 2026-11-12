const {test}=require('node:test');const assert=require('node:assert/strict');const P=require('../static/paper.js');
const stamp=s=>Date.parse(s);const now=stamp('2026-11-05T08:00:00Z');
const q={symbol:'2330.TW',name:'台積電',demo:false,dataKind:'daily',asOf:stamp('2026-11-05T05:30:00Z')/1000,price:100,history:[{time:stamp('2026-11-05T05:30:00Z')/1000,close:100}]};
const order=(id='1',side='buy',quantity=10,limit=110)=>({id,side,quantity,limit,note:'測試'});
const next={...q,history:[...q.history,{time:stamp('2026-11-06T05:30:00Z')/1000,close:105}]};
test('orders reserve cash, forbid same-day fills, settle once on later real close',()=>{const original=P.fresh();const a=P.place(original,q,order(),now);assert.equal(original.orders.length,0);assert.ok(P.reserves(a).cash>1100);assert.equal(P.settle(a,[q],now).trades.length,0);const b=P.settle(a,[next],now+86400000);assert.equal(b.orders[0].status,'filled');assert.equal(b.positions[q.symbol].quantity,10);assert.equal(b.trades[0].price,105.11);assert.deepEqual(P.settle(b,[next],now+86400000),b);assert.equal(P.reserves(b).cash,0);});
test('after-midnight orders cannot fill a close from their submission date',()=>{const a=P.place(P.fresh(),q,order(),stamp('2026-11-05T17:00:00Z'));assert.equal(P.settle(a,[next],now+86400000).trades.length,0);});
test('price caps expire and release reservation without changing money',()=>{const a=P.place(P.fresh(),q,order('1','buy',10,101),now);const b=P.settle(a,[next],now+86400000);assert.equal(b.orders[0].status,'expired');assert.equal(b.cash,1000000);assert.equal(P.reserves(b).cash,0);});
test('cancel releases funds and cannot cancel filled order',()=>{const a=P.place(P.fresh(),q,order(),now);assert.equal(P.reserves(P.cancel(a,'1')).cash,0);const b=P.settle(a,[next],now+86400000);assert.throws(()=>P.cancel(b,'1'));});
test('blocks overspending across pending orders, overselling, demo and stale prices',()=>{const a=P.place(P.fresh(),q,order('1','buy',8000,110),now);assert.throws(()=>P.place(a,{...q,symbol:'2317.TW'},order('2','buy',2000,110),now));assert.throws(()=>P.place(a,q,order('3'),now));assert.throws(()=>P.place(P.fresh(),q,order('1','sell'),now));assert.throws(()=>P.place(P.fresh(),{...q,demo:true},order(),now));assert.throws(()=>P.place(P.fresh(),q,order(),now+9*86400000));});
test('sell realizes costs and taxes and removes closed positions',()=>{let a=P.settle(P.place(P.fresh(),q,order(),now),[next],now+86400000);const nq={...next,asOf:next.history.at(-1).time};a=P.place(a,nq,order('2','sell',10,90),now+86400000);const third={...nq,history:[...next.history,{time:stamp('2026-11-09T05:30:00Z')/1000,close:120}]};a=P.settle(a,[third],now+4*86400000);assert.deepEqual(a.positions,{});assert.ok(Math.abs(a.cash-1000000-a.realized)<.001);assert.equal(a.trades[0].tax,3.6);assert.ok(a.realized>0);});
test('missing original history expires instead of inventing a later fill',()=>{const a=P.place(P.fresh(),q,order(),now);const b=P.settle(a,[{...next,history:next.history.slice(1)}],now+86400000);assert.equal(b.orders[0].status,'expired');assert.equal(b.trades.length,0);});
test('invalid backup and inputs are rejected',()=>{assert.throws(()=>P.validate({...P.fresh(),cash:-1}));for(const quantity of [0,1.5,NaN])assert.throws(()=>P.place(P.fresh(),q,order('1','buy',quantity),now));assert.throws(()=>P.place(P.fresh(),q,order('1','buy',1,.001),now));});
test('expanded universe accepts listed/OTC names and taxes equity ETFs correctly',()=>{assert.equal(P.taxRate('00878.TW'),.001);assert.equal(P.taxRate('0056.TW'),.001);assert.equal(P.taxRate('6488.TWO'),.003);assert.equal(P.place(P.fresh(),{...q,symbol:'6488.TWO'},order(),now).orders[0].symbol,'6488.TWO');});

test('full-directory paper orders require verified new symbols and backups remain valid',()=>{
 const q={symbol:'2603.TW',name:'長榮',price:100,demo:false,dataKind:'daily',asOf:Date.now()/1000-1,history:[]};
 assert.throws(()=>P.place(P.fresh(),q,{side:'buy',quantity:1,limit:110,id:'directory',note:''}));
 const a=P.place(P.fresh(),{...q,marketVerified:true},{side:'buy',quantity:1,limit:110,id:'directory',note:''});assert.equal(P.validate(JSON.parse(JSON.stringify(a))).orders[0].symbol,'2603.TW');
 assert.equal(P.taxRate('00679B.TWO',Date.parse('2026-11-09T08:00:00Z')),0);assert.equal(P.taxRate('00679B.TWO',Date.parse('2027-01-01T08:00:00Z')),.001);
});
test('pending explanations separate next-session close from publication and missing history',()=>{
 const morning=stamp('2026-11-10T02:52:39Z'),prior={...q,asOf:stamp('2026-11-09T05:30:00Z')/1000,history:[{time:stamp('2026-11-09T05:30:00Z')/1000,close:100}]};
 const today=P.place(P.fresh(),prior,order('today'),morning).orders[0];assert.equal(P.expectedDate(today),'2026-11-11');assert.equal(P.pendingInfo(today,prior,'2026-11-09',stamp('2026-11-10T05:39:00Z')).state,'session');
 const friday={...q,asOf:stamp('2026-11-06T05:30:00Z')/1000,history:[{time:stamp('2026-11-06T05:30:00Z')/1000,close:100}]},yesterday=P.place(P.fresh(),friday,order('yesterday'),stamp('2026-11-09T02:21:00Z')).orders[0];
 assert.equal(P.pendingInfo(yesterday,prior,'2026-11-09',stamp('2026-11-10T05:39:00Z')).state,'publication');assert.equal(P.pendingInfo(yesterday,prior,'2026-11-09',stamp('2026-11-10T11:00:00Z')).needsHistory,true);
});
test('old non-focus pending orders request history, while future-session orders do not',()=>{
 const old=P.place(P.fresh(),{...q,symbol:'2603.TW',marketVerified:true},order(),now);
 assert.deepEqual(P.syncTargets(old,[],[{symbol:'2603.TW',tradeDate:'2026-11-09'}],stamp('2026-11-10T05:39:00Z')),['2603.TW']);
 assert.deepEqual(P.syncTargets(old,[],[],now),[]);
 const filled=P.settle(old,[{...next,symbol:'2603.TW'}],now+86400000);
 assert.deepEqual(P.syncTargets(filled,[],[],now+86400000),['2603.TW']);
 assert.deepEqual(P.syncTargets(filled,[{...next,symbol:'2603.TW',price:105,asOf:next.history.at(-1).time}],[],now+86400000),[]);
});
test('limit rejection names actual date and simulated price without inventing holdings',()=>{
 const a=P.place(P.fresh(),q,order('reason','buy',10,101),now),b=P.settle(a,[next],now+86400000);
 assert.match(b.orders[0].message,/2026-11-06/);assert.match(b.orders[0].message,/105.11/);assert.match(b.orders[0].message,/101.00/);assert.equal(b.orders[0].evaluatedAt,next.history.at(-1).time*1000);assert.deepEqual(b.positions,{});assert.equal(b.cash,a.cash);
});
test('zero-volume next session cannot create a paper position and later refresh cannot fill it',()=>{
 const a=P.place(P.fresh(),q,order(),now),zero={...next,history:[q.history[0],{...next.history[1],volume:0}]},b=P.settle(a,[zero],now+86400000);
 assert.equal(b.orders[0].status,'expired');assert.deepEqual(b.positions,{});assert.equal(b.trades.length,0);assert.deepEqual(P.settle(b,[next],now+86400000),b);
});
test('weekend expectation is a hint, not a fabricated session',()=>{
 const fq={...q,asOf:stamp('2026-11-06T05:30:00Z')/1000},a=P.place(P.fresh(),fq,order(),stamp('2026-11-06T08:00:00Z'));
 assert.equal(P.expectedDate(a.orders[0]),'2026-11-09');assert.equal(P.settle(a,[fq],stamp('2026-11-09T04:00:00Z')).trades.length,0);
});
test('full money converts to whole shares including fees, without portfolio percentage cuts',()=>{
 assert.deepEqual(P.amountShares(30000,745.75),{shares:40,cost:29872.51,fee:42.51,left:127.49,price:745.75});
 for(const price of [.01,1,99.99,745.75,3000])for(const amount of [1,1000,30000,1000000]){const r=P.amountShares(amount,price);assert.ok(r.cost<=amount);assert.ok(r.left>=0);const gross=Math.round((r.shares+1)*price*100)/100,next=Math.round((gross+Math.round(gross*P.feeRate*100)/100)*100)/100;assert.ok(next>amount);}
 assert.equal(P.amountShares(100,745.75).shares,0);assert.throws(()=>P.amountShares(NaN,100));
});
test('known-close practice creates holdings now and records added capital separately from gains',()=>{
 const original=P.fresh(),a=P.place(original,q,{...order('free','buy',20000),execution:'known-close',autoFund:true},now);
 assert.equal(original.orders.length,0);assert.equal(a.orders[0].status,'filled');assert.equal(a.positions[q.symbol].quantity,20000);assert.equal(a.cash,0);assert.equal(a.funding[0].amount,1004852.85);assert.equal(P.capital(a),2004852.85);assert.equal(a.positions[q.symbol].cost,2004852.85);assert.equal(a.trades[0].priceAsOf,q.asOf);assert.equal(a.trades[0].time,now);assert.match(a.orders[0].message,/非即時|並非即時/);assert.equal(P.reserves(a).cash,0);
 assert.deepEqual(P.settle(a,[next],now+86400000),a);assert.deepEqual(P.validate(JSON.parse(JSON.stringify(a))),a);
 const sold=P.place(a,q,{...order('sell-free','sell',20000),execution:'known-close',autoFund:true},now+1000);assert.deepEqual(sold.positions,{});assert.equal(sold.funding.length,1);assert.equal(P.capital(sold),P.capital(a));assert.equal(sold.cash-P.capital(sold),sold.realized);
});
test('auto-funding a legacy pending order preserves reservation, cancellation and original capital',()=>{
 const a=P.place(P.fresh(),q,{...order('funded-pending','buy',20000),autoFund:true},now);assert.equal(a.orders[0].status,'pending');assert.equal(a.positions[q.symbol],undefined);assert.equal(P.reserves(a).cash,a.cash);
 const b=P.cancel(a,'funded-pending');assert.equal(P.reserves(b).cash,0);assert.equal(b.cash,P.capital(b));assert.deepEqual(b.funding,a.funding);
 assert.throws(()=>P.validate({...a,funding:[...a.funding,...a.funding]}));assert.throws(()=>P.validate({...a,funding:[{...a.funding[0],orderId:'unknown'}]}));assert.throws(()=>P.place(a,q,{...order('funded-pending'),autoFund:true},now));
});
test('free known-close mode still rejects invalid sources, shorts and duplicate submissions',()=>{
 const input={...order('known','buy',1),execution:'known-close',autoFund:true};for(const bad of [{demo:true},{asOf:1},{asOf:now/1000+100},{sync:{error:'bad'}}])assert.throws(()=>P.place(P.fresh(),{...q,...bad},input,now));
 const a=P.place(P.fresh(),q,input,now);assert.throws(()=>P.place(a,q,input,now));assert.throws(()=>P.place(a,q,{...input,id:'short',side:'sell',quantity:2},now));assert.equal(a.funding,undefined);
});
