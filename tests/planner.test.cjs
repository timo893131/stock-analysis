const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../static/planner.js'),P=require('../static/paper.js');
const now=Date.parse('2026-11-11T16:00:00+08:00'),quoteAt=Date.parse('2026-11-10T13:30:00+08:00')/1000;
const q={symbol:'2330.TW',name:'台積電',source:'測試行情',price:100,asOf:quoteAt,demo:false,dataKind:'daily'};
const input={budget:30000,maxLoss:300,entry:100,stop:95,target:115,positionPct:25,bufferPct:10,maxOrder:10000,minRR:1};
test('risk sizing includes round-trip fees, tax and slippage; the smallest of four caps wins',()=>{
 const r=D.calculate(input,q,P.fresh(),now);assert.equal(r.shares,53);assert.deepEqual(r.binding,['loss']);assert.ok(r.loss<=300);assert.ok(r.reserved<=7500);assert.ok(r.reserved<=10000);assert.ok(r.rr>2&&r.rr<3);assert.equal(r.allowed,true);
 assert.equal(D.calculate({...input,maxLoss:3000,maxOrder:500},q,P.fresh(),now).shares,4);
 assert.equal(D.calculate({...input,maxLoss:3000,positionPct:1},q,P.fresh(),now).shares,2);
 assert.equal(D.calculate({...input,maxLoss:3000,bufferPct:95},q,P.fresh(),now).shares,14);
});
test('existing exposure, other pending reserves and duplicate entries cannot be ignored',()=>{
 const a=P.fresh();a.positions[q.symbol]={quantity:70,cost:7000};a.cash=993000;
 const r=D.calculate(input,q,a,now);assert.equal(r.shares,4);assert.equal(r.exposure,7000);
 const pending=P.place(P.fresh(),{...q,history:[]},{side:'buy',quantity:1,limit:100,id:'pending',note:''},now);
 assert.equal(D.calculate(input,q,pending,now).allowed,false);assert.match(D.calculate(input,q,pending,now).reasons.join(' '),/待成交/);
 const reserved=P.place(P.fresh(),{...q,symbol:'2317.TW',history:[]},{side:'buy',quantity:9900,limit:100,id:'reserve',note:''},now);
 assert.ok(D.calculate({...input,maxLoss:3000,positionPct:100},q,reserved,now).reserved<=reserved.cash-P.reserves(reserved).cash);
});
test('a higher known close increases risk without silently raising the actual limit',()=>{
 const r=D.calculate({...input,target:140},{...q,price:120},P.fresh(),now);assert.equal(r.inputs.entry,100);assert.equal(r.sizingEntry,120);assert.equal(r.usesHigherReference,true);assert.ok(r.shares<53);assert.equal(r.allowed,false);
});
test('price order, empty funds, zero shares, demo, future and stale data fail clearly',()=>{
 for(const bad of [{stop:101},{target:99},{budget:''},{maxLoss:0},{positionPct:101},{positionPct:.5},{minRR:0},{entry:100.004,stop:100.003}])assert.throws(()=>D.calculate({...input,...bad},q,P.fresh(),now));
 for(const bad of [{demo:true},{asOf:now/1000+60},{asOf:now/1000-8*86400},{sync:{error:'timeout'}},{price:NaN}])assert.throws(()=>D.calculate(input,{...q,...bad},P.fresh(),now));
 const small=D.calculate({...input,maxLoss:.01},q,P.fresh(),now);assert.equal(small.shares,0);assert.equal(small.allowed,false);
});
test('ETF tax assumptions differ, without pretending future tax changes are known',()=>{
 const stock=D.calculate(input,q,P.fresh(),now),equity=D.calculate(input,{...q,symbol:'0050.TW'},P.fresh(),now),bond=D.calculate(input,{...q,symbol:'00679B.TWO'},P.fresh(),now);
 assert.ok(stock.riskPerShare>equity.riskPerShare);assert.ok(equity.riskPerShare>bond.riskPerShare);assert.equal(bond.tax,0);
});
test('saved plans freeze original inputs and never create or change paper orders',()=>{
 const account=P.fresh(),before=structuredClone(account),raw=structuredClone(input),r=D.calculate(raw,q,account,now),book=D.record({version:1,items:[]},r,'plan-1',now);
 raw.stop=1;r.inputs.stop=2;assert.equal(book.items[0].inputs.stop,95);assert.deepEqual(account,before);assert.equal(D.validateBook(JSON.parse(JSON.stringify(book))).items.length,1);
 assert.throws(()=>D.record(book,{...r,allowed:false},'plan-2',now));assert.throws(()=>D.validateBook({...book,items:[book.items[0],book.items[0]]}));assert.throws(()=>D.validateBook({...book,items:[{...book.items[0],shares:-1}]}));
});
test('observations only compare later published closes, never claim an execution or a return',()=>{
 const plan=D.record({version:1,items:[]},D.calculate(input,q,P.fresh(),now),'plan-1',now).items[0];
 assert.equal(D.observation(plan,q,now).state,'waiting');
 const later={...q,asOf:Date.parse('2026-11-12T13:30:00+08:00')/1000};const t=Date.parse('2026-11-12T19:00:00+08:00');
 assert.equal(D.observation(plan,{...later,price:94},t).state,'stop');assert.equal(D.observation(plan,{...later,price:120},t).state,'target');assert.equal(D.observation(plan,{...later,price:105},t).state,'watch');
 assert.equal(D.observation(plan,{...later,symbol:'2317.TW',price:94},t).state,'waiting');assert.equal(D.observation(plan,{...later,price:94},now).state,'waiting');
});
