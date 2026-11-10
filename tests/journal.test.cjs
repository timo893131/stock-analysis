const {test}=require('node:test'),assert=require('node:assert/strict'),J=require('../static/journal.js');
const now=Date.parse('2026-11-10T15:00:00+08:00'),later=Date.parse('2026-11-12T15:00:00+08:00');
const q={symbol:'2379.TW',name:'瑞昱',price:100,tradeDate:'2026-11-09',source:'TWSE OpenAPI',demo:false,asOf:Date.parse('2026-11-09T13:30:00+08:00')/1000};
const input={id:'record-1',choice:'watch',note:'先確認營收',question:'下一次營收還成長嗎？'};
const entry=()=>J.create(q,input,null,now);
test('records require real fresh closing prices and valid reasons',()=>{
 for(const bad of [{...q,demo:true},{...q,demo:true,snapshotVerified:true},{...q,asOf:now/1000+1000},{...q,price:null},{...q,tradeDate:'2026-11-11'},{...q,tradeDate:'2026-10-01'}])assert.throws(()=>J.create(bad,input,null,now));
 assert.throws(()=>J.create(q,{...input,note:''},null,now));assert.throws(()=>J.create(q,{...input,question:''},null,now));
 assert.equal(entry().price,100);
});
test('journal cannot use same-day already-known closes to assess a decision',()=>{
 const e=entry();assert.equal(J.compare(e,[{...q,tradeDate:'2026-11-10',price:120}],later).ready,false);
 assert.equal(J.compare(e,[{...q,tradeDate:'2026-11-09',price:120}],later).ready,false);
 const c=J.compare(e,[{...q,tradeDate:'2026-11-11',price:110}],later);assert.equal(c.ready,true);assert.ok(Math.abs(c.change-10)<1e-9);assert.equal(c.tradeDate,'2026-11-11');
});
test('future, demo and stale observations never become returns',()=>{
 const e=entry();for(const bad of [{...q,tradeDate:'2026-11-13'},{...q,tradeDate:'2026-11-11',demo:true},{...q,tradeDate:'2026-11-11',price:0}])assert.equal(J.compare(e,[bad],later).ready,false);
 assert.equal(J.compare(e,[{...q,tradeDate:'2026-11-11'}],later+10*86400000).ready,false);
});
test('original AI evidence is copied and later reports cannot replace it',()=>{
 const ai={symbol:q.symbol,asOf:q.asOf,status:'ready',model:'test',generatedAt:new Date(now-1000).toISOString(),summary:'原始判斷',risks:'風險',checks:'查證'};
 const e=J.create(q,input,ai,now);ai.summary='事後修改';assert.equal(e.ai.summary,'原始判斷');assert.equal(J.create(q,input,{...ai,symbol:'2330.TW'},now).ai,null);
 const j=J.review(J.add(J.fresh(),e,now),e.id,'新證據出現了',later);assert.equal(j.entries[0].ai.summary,'原始判斷');assert.equal(j.entries[0].price,100);
});
test('backup merges retain current evidence and mark imported records',()=>{
 const current=J.add(J.fresh(),entry(),now),incoming=J.add(J.fresh(),J.create(q,{...input,id:'second'},null,now),now);
 const merged=J.merge(current,incoming,now);assert.equal(merged.entries.length,2);assert.equal(merged.entries.find(e=>e.id==='second').imported,true);
 assert.equal(J.merge(merged,incoming,now).entries.length,2);assert.throws(()=>J.merge(current,{version:1,entries:[{...entry(),price:999}]},now),/編號/);
});
test('invalid backups and overflow fail without rewriting data',()=>{
 const j=J.add(J.fresh(),entry(),now),before=JSON.stringify(j);assert.throws(()=>J.add(j,entry(),now));assert.equal(JSON.stringify(j),before);
 for(const value of [{version:2,entries:[]},{version:1,entries:[{...entry(),createdAt:later}]},{version:1,entries:Array.from({length:101},(_,i)=>({...entry(),id:String(i)}))}])assert.throws(()=>J.validate(value,now));
 assert.equal(J.remove(j,'record-1',now).entries.length,0);assert.equal(j.entries.length,1);
});
