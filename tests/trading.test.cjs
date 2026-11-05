const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execute,analysis}=require('../static/app.js');
const now=1800000000000;
const base=()=>({cash:1000000,positions:{},trades:[],realized:0});
const q={symbol:'2330.TW',name:'台積電',price:100,demo:false,asOf:now/1000};
test('buy and sell account for fees, tax, cost basis and realized profit',()=>{
 const initial=base();let a=execute(initial,q,'buy',100,now);
 assert.equal(initial.cash,1000000);assert.equal(a.cash,989985.75);assert.equal(a.positions[q.symbol].cost,10014.25);
 a=execute(a,{...q,price:120},'sell',50,now);
 assert.equal(a.positions[q.symbol].quantity,50);assert.equal(a.positions[q.symbol].cost,5007.125);
 assert.ok(Math.abs(a.realized-966.325)<1e-8);assert.equal(a.trades.length,2);
});
test('reject fabricated, stale and invalid trades without mutating account',()=>{
 for(const price of [{...q,demo:true},{...q,asOf:q.asOf-901},{...q,price:NaN}])assert.throws(()=>execute(base(),price,'buy',1,now));
 for(const qty of [0,-1,1.5,NaN,1000001])assert.throws(()=>execute(base(),q,'buy',qty,now));
 assert.throws(()=>execute(base(),q,'sell',1,now));assert.throws(()=>execute(base(),q,'buy',10000,now));
});
test('ETF uses 0.1 percent sell tax and closes position',()=>{let a=execute(base(),{...q,symbol:'0050.TW'},'buy',10,now);a=execute(a,{...q,symbol:'0050.TW'},'sell',10,now);assert.equal(a.trades[0].tax,1);assert.deepEqual(a.positions,{});});
test('flat historical prices have zero volatility',()=>{const a=analysis({history:Array.from({length:30},()=>({close:100}))});assert.equal(a.vol,0);assert.equal(a.low,100);assert.equal(a.high,100);assert.equal(a.trend,'持續觀察');});
test('daily close cannot masquerade as a current executable price',()=>{assert.throws(()=>execute(base(),{...q,dataKind:'daily'},'buy',1,now));assert.throws(()=>execute(base(),{...q,tradable:false},'buy',1,now));});
