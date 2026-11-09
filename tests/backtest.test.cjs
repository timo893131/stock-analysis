const {test}=require('node:test');
const assert=require('node:assert/strict');
const {run}=require('../static/backtest.js');
const bars=values=>values.map((close,i)=>({time:1700000000+i*86400,close}));
const flat=()=>bars(Array(65).fill(100));
test('flat prices produce no trend trades, baseline pays trading costs',()=>{
 const r=run(flat());assert.equal(r.strategy.totalReturn,0);assert.equal(r.strategy.winRate,null);
 assert.equal(r.strategy.maxDrawdown,0);assert.ok(r.benchmark.totalReturn<0);
 assert.equal(r.benchmark.trades.length,2);
});
test('signals execute on later bars and never on their own close',()=>{
 const h=flat();for(let i=25;i<h.length;i++)h[i].close=130+i;
 const r=run(h);assert.ok(r.strategy.trades.length>=2);
 for(const t of r.strategy.trades)if(t.signalTime)assert.ok(t.time>t.signalTime);
 assert.equal(r.strategy.trades[0].signalTime,h[25].time);
 assert.equal(r.strategy.trades[0].time,h[26].time);
});
test('future price changes cannot alter earlier equity or trades',()=>{
 const h=bars(Array.from({length:90},(_,i)=>100+i+12*Math.sin(i/8)));
 const future=h.map((x,i)=>({...x,close:i>=60?x.close*3:x.close}));
 const a=run(h),b=run(future);
 assert.deepEqual(a.strategy.curve.filter(x=>x.time<h[60].time),b.strategy.curve.filter(x=>x.time<h[60].time));
 assert.deepEqual(a.strategy.trades.filter(x=>x.time<h[60].time),b.strategy.trades.filter(x=>x.time<h[60].time));
});
test('account reconciles cash, fees, and liquidation without borrowing',()=>{
 const r=run(bars(Array.from({length:100},(_,i)=>100+30*Math.sin(i/6))),{allocation:1});
 let cash=r.initial,shares=0,fees=0;
 for(const t of r.strategy.trades){fees+=t.fee+t.tax;if(t.side==='buy'){cash-=t.price*t.quantity+t.fee;shares+=t.quantity;}else{cash+=t.price*t.quantity-t.fee-t.tax;shares-=t.quantity;}assert.ok(cash>=-1e-7);assert.ok(shares>=0);}
 assert.equal(shares,0);assert.ok(Math.abs(cash-r.strategy.finalEquity)<1e-7);assert.ok(Math.abs(fees-r.strategy.fees)<1e-7);assert.ok(r.strategy.maxDrawdown>0);
});
test('ETF and stock baseline taxes use distinct rates',()=>{
 const stock=run(flat()),etf=run(flat(),{etf:true});
 assert.ok(etf.benchmark.finalEquity>stock.benchmark.finalEquity);
 assert.equal(stock.benchmark.trades[1].tax,stock.benchmark.trades[1].quantity*stock.benchmark.trades[1].price*.003);
});
test('invalid history, duplicates, insufficient samples and parameters are rejected',()=>{
 assert.throws(()=>run(flat().slice(0,25)));assert.throws(()=>run(flat(),{period:60}));
 for(const close of [0,-1,NaN,Infinity]){const h=flat();h[30].close=close;assert.throws(()=>run(h));}
 const h=flat();h[2].time=h[1].time;assert.throws(()=>run(h));
 assert.throws(()=>run(flat(),{allocation:2}));
});
test('terminal bar cannot open a new position',()=>{
 const h=flat();h[h.length-2].close=200;h.at(-1).close=210;
 assert.equal(run(h).strategy.trades.length,0);
});

test('bond ETF exemption is applied using the simulated sale date',()=>{
 const B=require('../static/backtest.js'),h=Array.from({length:90},(_,i)=>({time:Date.UTC(2026,6,i+1)/1000,close:100+i}));const r=B.run(h,{period:20,etf:true,bond:true});assert.ok(r.benchmark.trades.some(t=>t.side==='sell'));assert.ok(r.benchmark.trades.filter(t=>t.side==='sell').every(t=>t.tax===0));
});
