const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../static/decision.js');
const q={symbol:'2330.TW',demo:false,asOf:Date.now()/1000,price:120,history:Array.from({length:60},(_,i)=>({close:100+i/3}))};
test('blocks demo, stale and short histories',()=>{assert.equal(D.assess({...q,demo:true}).ready,false);assert.equal(D.assess({...q,asOf:1}).ready,false);assert.equal(D.assess({...q,history:[]}).ready,false);});
test('uptrend is a research condition, not a probability',()=>{const r=D.assess(q);assert.equal(r.label,'可列入小額研究');assert.ok(r.ma20>r.ma60);});
test('size respects fee-adjusted budget, cap and risk simultaneously',()=>{const r=D.size(q,{budget:100000,riskPct:1,stopPct:8,capPct:20});assert.ok(r.cost<=20000);assert.ok(r.loss<=1000);assert.ok(Number.isInteger(r.shares));const r2=D.size(q,{budget:100000,riskPct:.5,stopPct:8,capPct:20});assert.ok(r2.shares<=r.shares);});
test('invalid budget and risk are rejected and tiny budgets yield zero',()=>{assert.throws(()=>D.size(q,{budget:0,riskPct:1,stopPct:8,capPct:20}));assert.throws(()=>D.size(q,{budget:100000,riskPct:1,stopPct:0,capPct:20}));assert.equal(D.size(q,{budget:1,riskPct:1,stopPct:8,capPct:20}).shares,0);});
test('AI advice binds to symbol, date and freshness; legacy reports do not invent a recommendation',()=>{
 const ai={symbol:q.symbol,asOf:q.asOf,status:'ready',action:'consider',reason:'趨勢偏多',generatedAt:new Date().toISOString()};
 assert.equal(D.advice(q,ai).action,'consider');
 for(const a of [{...ai,symbol:'2603.TW'},{...ai,asOf:1},{...ai,generatedAt:'invalid'},{...ai,generatedAt:new Date(Date.now()-2*86400000).toISOString()},{...ai,action:'buy-now'},{...ai,action:undefined}])assert.equal(D.advice(q,a).action,'insufficient');
 assert.equal(D.advice({...q,demo:true},ai).action,'insufficient');
});
test('first entry is a fraction of cap, fee-adjusted and zero for waiting or insufficient budget',()=>{
 const ai={symbol:q.symbol,asOf:q.asOf,status:'ready',action:'consider',reason:'趨勢偏多',generatedAt:new Date().toISOString()};
 const r=D.entryPlan(q,ai,10000);assert.ok(r.shares>0);assert.ok(r.cost<=300);assert.ok(r.loss<=100);assert.ok(Number.isInteger(r.shares));
 assert.equal(D.entryPlan(q,ai,1).shares,0);
 for(const action of ['wait','avoid','insufficient'])assert.equal(D.entryPlan(q,{...ai,action},10000).cost,0);
 assert.throws(()=>D.entryPlan(q,ai,NaN));
});
test('budget parsing accepts pasted grouped/full-width amounts and rejects ambiguous input',()=>{
 for(const text of ['10000','10,000','ＮＴ＄ １０，０００','NT$ 10,000','新臺幣10000元',' 10000 '])assert.equal(D.parseBudget(text),10000);
 for(const text of ['', '1,00','-1000','1.5','1e5','NaN','Infinity','1000000001','0','abc10000'])assert.throws(()=>D.parseBudget(text));
});
