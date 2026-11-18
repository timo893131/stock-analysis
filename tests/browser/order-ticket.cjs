const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),P=require('../../static/paper.js');
const now=Date.parse('2026-11-17T18:00:00+08:00'),stamp=Date.parse('2026-11-17T13:30:00+08:00')/1000;
const q={symbol:'2330.TW',name:'台積電',sector:'tech',price:100,previous:99,change:1,asOf:stamp,tradeDate:'2026-11-17',demo:false,dataKind:'daily',history:[{time:stamp,close:100,volume:100000}]};
const initial=P.place(P.fresh(),q,{id:'existing',side:'buy',quantity:101,execution:'known-close',autoFund:true},now-1000);
initial.orders.push({id:'reserved-sell',symbol:q.symbol,name:q.name,side:'sell',quantity:11,limit:200,note:'保留的進階委託',status:'pending',createdAt:now-500,referenceTime:stamp});
const account=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('stockroom-paper-v2')));
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{for(const width of [360,390,1280]){
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(now)});await page.addInitScript(a=>localStorage.setItem('stockroom-paper-v2',JSON.stringify(a)),initial);
 await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({status:404}));let liveQuote={...q};await page.route('**/data/quotes.json',r=>r.fulfill({json:{quotes:[liveQuote]}}));await page.route('**/data/ai.json',r=>r.fulfill({json:{reports:[]}}));await page.route('**/data/full-market.json',r=>r.fulfill({json:{status:'ready',quotes:[]}}));
 await page.goto((process.env.TEST_SITE_URL||'http://127.0.0.1:8005/')+'#portfolio',{waitUntil:'domcontentloaded'});await page.locator('[data-paper-sell]').click();await page.locator('#sell-half').click();assert.equal(await page.locator('#quantity').inputValue(),'45');const text=await page.locator('#order-estimate').innerText();assert.match(text,/交易稅/);assert.match(text,/費稅後損益/);
 await page.locator('#trade-form [type=submit]').click();assert.deepEqual(await account(page),initial);assert.equal(await page.locator('#trade-error').innerText(),'');assert.match(await page.locator('#trade-step').innerText(),/尚未送出/);assert.match(await page.locator('#paper-review-body').innerText(),/56 股/);assert.equal(await page.locator('#paper-fields').isVisible(),false);
 assert.equal(await page.locator('#trade-dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);if(width===390)await page.screenshot({path:'/tmp/stockroom-order-review.png'});
 await page.locator('#paper-edit').click();await page.locator('#quantity').fill('91');await page.locator('#trade-form [type=submit]').click();assert.match(await page.locator('#trade-error').innerText(),/可賣股數/);assert.deepEqual(await account(page),initial);
 await page.locator('#sell-half').click();await page.locator('#trade-form [type=submit]').click();await page.locator('#paper-confirm').evaluate(el=>{el.click();el.click();});const sold=await account(page);assert.equal(sold.orders.length,3);assert.equal(sold.positions[q.symbol].quantity,56);assert.equal(P.reserves(sold).shares[q.symbol],11);assert.match(await page.locator('#paper-receipt').innerText(),/虛擬成交完成/);assert.match(await page.locator('#paper-receipt').innerText(),/實際入帳/);
 await page.locator('[data-order-filter=pending]').click();assert.equal(await page.locator('.order-card').count(),1);await page.locator('[data-order-filter=filled]').click();assert.equal(await page.locator('.order-card').count(),2);await page.locator('[data-order-filter=cancelled]').click();assert.equal(await page.locator('.order-card').count(),0);await page.locator('[data-order-filter=all]').click();
 await page.locator('#paper-new').click();await page.locator('#paper-amount').fill('30000');await page.locator('#trade-form [type=submit]').click();await page.locator('#close-dialog').click();assert.deepEqual(await account(page),sold);
 // A second tab changes the account after preview. Confirmation must not overwrite it.
 await page.locator('#paper-new').click();await page.locator('#paper-amount').fill('30000');await page.locator('#trade-form [type=submit]').click();const updated=P.cancel(sold,'reserved-sell');await page.evaluate(a=>localStorage.setItem('stockroom-paper-v2',JSON.stringify(a)),updated);await page.locator('#paper-confirm').click();assert.match(await page.locator('#trade-error').innerText(),/其他分頁/);assert.deepEqual(await account(page),updated);
 await page.locator('#trade-form [type=submit]').click();await context.setOffline(true);await page.locator('#paper-confirm').click();assert.match(await page.locator('#trade-error').innerText(),/離線/);assert.deepEqual(await account(page),updated);await context.setOffline(false);await page.locator('#trade-form [type=submit]').click();await page.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='stockroom-paper-v2')throw Error('quota test');return window.savedSetItem.call(this,key,value);};});await page.locator('#paper-confirm').click();assert.match(await page.locator('#trade-error').innerText(),/尚未儲存/);assert.deepEqual(await account(page),updated);await page.evaluate(()=>{Storage.prototype.setItem=window.savedSetItem;});await page.locator('#trade-form [type=submit]').click();await page.locator('#paper-confirm').click();const bought=await account(page);assert.equal(bought.orders.length,4);assert.equal(bought.positions[q.symbol].quantity,56+P.amountShares(30000,P.executionPrice(q,'buy')).shares);assert.match(await page.locator('#paper-receipt').innerText(),/實際扣款/);if(width===390)await page.screenshot({path:'/tmp/stockroom-order-receipt.png'});
 // A refreshed close while reviewing must invalidate the draft and recalculate the same budget.
 await page.locator('#paper-new').click();await page.locator('#paper-amount').fill('30000');await page.locator('#trade-form [type=submit]').click();liveQuote={...q,price:200,history:[{...q.history[0],close:200}]};await page.locator('#refresh').evaluate(el=>el.click());await page.waitForFunction(()=>document.querySelector('#detail-price').textContent==='200.00');await page.locator('#paper-confirm').click();assert.match(await page.locator('#trade-error').innerText(),/行情或帳戶已更新/);assert.deepEqual(await account(page),bought);await page.locator('#trade-form [type=submit]').click();assert.equal(await page.locator('#quantity').inputValue(),String(P.amountShares(30000,P.executionPrice(liveQuote,'buy')).shares));assert.match(await page.locator('#paper-review-body').innerText(),/200.20/);await page.locator('#close-dialog').click();
 await page.locator('#paper-new').click();await page.locator('#paper-find').click();await page.locator('#app-search-dialog').waitFor({state:'visible'});assert.deepEqual(await account(page),bought);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await context.close();
}await searchAndBuy(browser);
console.log('PASS order ticket at 360/390/1280: review has no writes, partial sell respects reservations, fee/pnl preview, edit/cancel, receipt, filters, double-click, account change and offline protections, full-market search');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

async function searchAndBuy(browser){
 const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}});
 await page.clock.install({time:new Date(now)});
 const symbol='2603.TW';
 const closes=Array.from({length:65},(_,i)=>({time:stamp-(64-i)*86400,close:120,volume:2000000}));
 const found={...q,symbol,name:'長榮',marketVerified:true,history:closes,price:120};
 const snapshot={quotes:[{symbol,name:'長榮',market:'上市',price:120,tradeDate:q.tradeDate}],markets:{twse:{status:'ready',tradeDate:q.tradeDate}},status:'ready'};
 let requests=0;
 await page.route('**/data/quotes.json',r=>r.fulfill({json:{quotes:[q]}}));
 await page.route('**/data/full-market.json',r=>r.fulfill({json:snapshot}));
 await page.route('https://raw.githubusercontent.com/**',r=>r.request().url().includes('/service-config/')?r.fulfill({json:{url:'https://picker-test.example.workers.dev',mode:'public'}}):r.fulfill({status:404}));
 await page.route('https://picker-test.example.workers.dev/research',r=>{
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'};
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
  assert.deepEqual(JSON.parse(r.request().postData()),{symbol,ai:false});
  requests++;
  if(requests===1)return r.fulfill({status:503,headers,json:{error:'測試來源暫不可用'}});
  return r.fulfill({headers,json:{quote:found}});
 });
 await page.goto((process.env.TEST_SITE_URL||'http://127.0.0.1:8005/')+'#portfolio',{waitUntil:'domcontentloaded'});
 await page.locator('#paper-new').click();
 await page.locator('#paper-amount').fill('1000');
 await page.locator('#paper-find').click();
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#paper-amount').inputValue(),'1000');
 await page.locator('#close-dialog').click();
 await page.locator('#paper-pick').click();
 await page.locator('#app-search-input').fill('２６０３');
 const result=page.locator('[data-open-symbol="2603.TW"]');
 await result.waitFor();
 assert.equal(requests,0);
 await result.click();
 await page.waitForFunction(()=>document.querySelector('#app-search-feedback').textContent==='測試來源暫不可用');
 assert.equal(await page.locator('#trade-dialog').isVisible(),false);
 assert.equal(await account(page),null);
 await result.click();
 await page.locator('#trade-dialog').waitFor();
 assert.equal(await page.locator('#paper-symbol').inputValue(),symbol);
 assert.ok(page.url().endsWith('#portfolio'));
 await page.locator('#paper-amount').fill('30000');
 await page.locator('#trade-form [type=submit]').click();
 await page.locator('#paper-confirm').click();
 await page.locator('#paper-receipt').waitFor();
 const saved=await account(page);
 assert.equal(saved.positions[symbol].quantity,249);
 assert.match(await page.locator('.holding-card').innerText(),/官方收盤快照/);
 assert.match(await page.locator('.holding-card').innerText(),/可賣 249 股/);
 await page.locator('[data-paper-add="2603.TW"]').click();
 await page.locator('#trade-dialog').waitFor();
 assert.equal(await page.locator('#paper-symbol').inputValue(),symbol);
 assert.equal(requests,2);
 await page.close();
 console.log('PASS full-market picker: draft survives cancel, full-width code, request failure and retry, direct non-focus order, snapshot valuation and repeat buy');
}
