const {test}=require('node:test');
const assert=require('node:assert/strict');
const {review}=require('../static/holding-review.js');
const P=require('../static/paper.js');
const close=Date.parse('2026-11-20T13:30:00+08:00')/1000;
const now=close*1000+3600000;
const quote=prices=>({
 symbol:'2330.TW',name:'台積電',demo:false,dataKind:'daily',asOf:close,
 price:prices.at(-1),source:'FinMind',
 history:prices.map((price,index)=>({close:price,time:close-(prices.length-1-index)*86400,volume:1000}))
});
const position={quantity:101,cost:10100};
const flat=quote(Array(60).fill(100));
const falling=quote(Array.from({length:60},(_,i)=>150-i));

test('hold, watch, short weakness and sustained weakness use separate evidence and quantities',()=>{
 const rising=quote(Array.from({length:60},(_,i)=>100+i));
 assert.equal(review({quote:rising,position,now}).action,'hold');
 const mixed=review({quote:flat,position,now});
 assert.equal(mixed.action,'watch');assert.equal(mixed.shares,0);
 const turning=quote([...Array(40).fill(80),...Array(19).fill(100),78]);
 const mild=review({quote:turning,position,now});
 assert.equal(mild.action,'reduce');assert.equal(mild.fraction,.25);assert.equal(mild.shares,25);
 const strong=review({quote:falling,position,reserved:12,now});
 assert.equal(strong.fraction,.5);assert.equal(strong.target,50);
 assert.equal(strong.shares,38);assert.equal(strong.sellable,89);
 assert.equal(strong.change,91/111-1);assert.equal(strong.ma20,100.5);assert.equal(strong.ma60,120.5);
 assert.deepEqual(strong.proceeds,P.estimate({positions:{'2330.TW':position}},'2330.TW','sell',38,P.executionPrice(falling,'sell'),now));
 assert.equal(review({quote:falling,position,reserved:78,now}).shares,0);
 assert.equal(review({quote:falling,position:{quantity:1,cost:100},now}).shares,0);
});
test('invalid, stale, mismatching and newer market data do not produce a sell estimate',()=>{
 for(const q of [
  {...falling,demo:true},
  {...falling,sync:{error:'failed'}},
  {...falling,price:110},
  {...falling,history:falling.history.slice(1)},
  {...falling,history:falling.history.map((b,i)=>i===1?{...b,time:b.time-86400}:b)},
  {...falling,history:falling.history.map((b,i)=>i===59?{...b,volume:0}:b)}
 ])assert.equal(review({quote:q,position,now}).action,'unavailable');
 assert.equal(review({quote:falling,position,now:now+8*86400000}).action,'unavailable');
 assert.match(review({quote:falling,position,now,officialClose:{date:'2026-11-23',price:90}}).reason,/快照已更新/);
 assert.match(review({quote:falling,position,now,officialClose:{date:'2026-11-20',price:92}}).reason,/收盤價不同/);
});
