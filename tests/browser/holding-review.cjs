const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const P=require('../../static/paper.js');
const now=Date.parse('2026-11-20T18:00:00+08:00');
const asOf=Date.parse('2026-11-20T13:30:00+08:00')/1000;
const symbol='2330.TW';
const q={symbol,name:'台積電',demo:false,dataKind:'daily',sector:'tech',price:91,asOf,source:'FinMind · 日收盤',
 tradeDate:'2026-11-20',history:Array.from({length:60},(_,i)=>({close:150-i,time:asOf-(59-i)*86400,volume:1000}))};
let original=P.place(P.fresh(),q,{id:'buy',side:'buy',quantity:100,execution:'known-close',autoFund:true},now-5000);
original=P.place(original,q,{id:'waiting-sale',side:'sell',quantity:20,limit:200,execution:'next-close'},now-2000);
const getAccount=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('stockroom-paper-v2')));
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({serviceWorkers:'block',viewport:{width,height:840}});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.clock.install({time:new Date(now)});
   await page.addInitScript(a=>localStorage.setItem('stockroom-paper-v2',JSON.stringify(a)),original);
   let displayed=q;
   await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({status:404}));
   await page.route('**/data/quotes.json',r=>r.fulfill({json:{quotes:[displayed]}}));
   await page.route('**/data/full-market.json',r=>r.fulfill({json:{status:'ready',quotes:[]}}));
   await page.goto((process.env.TEST_SITE_URL||'http://127.0.0.1:8009/')+'#portfolio',{waitUntil:'domcontentloaded'});
   await page.locator('.holding-review-summary p').filter({hasText:'可考慮分批賣出'}).waitFor();
   await page.locator('[data-paper-holding-review]').click();
   const dialog=page.locator('#holding-review-dialog'),body=page.locator('#holding-review-body');
   await dialog.waitFor();
   const evidence=await body.innerText();
   for(const fact of ['20 日均線','60 日均線','100.50','120.50','-18.02%','50%（50 股）','本次可帶入 30 股','20 股','FinMind','2026-11-20'])assert.ok(evidence.includes(fact),fact);
   assert.deepEqual(await getAccount(page),original);
   assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false);
   if(width===390)await dialog.screenshot({path:'/tmp/stockroom-holding-review-mobile.png'});
   await page.locator('#holding-review-sell').click();
   assert.equal(await page.locator('#side').inputValue(),'sell');
   assert.equal(await page.locator('#quantity').inputValue(),'30');
   await page.locator('#trade-form [type=submit]').click();
   assert.deepEqual(await getAccount(page),original);
   await page.locator('#paper-confirm').click();
   await page.locator('#paper-receipt').waitFor();
   const account=await getAccount(page);
   assert.equal(account.positions[symbol].quantity,70);
   assert.equal(account.orders.find(o=>o.id==='waiting-sale').status,'pending');
   displayed={...q,sync:{error:'missing data'}};
   await page.locator('#refresh').click();
   await page.locator('.holding-review-summary p').filter({hasText:'待補資料'}).waitFor();
   await page.locator('[data-paper-holding-review]').click();
   assert.match(await body.innerText(),/需要七天內有效/);
   assert.equal(await page.locator('#holding-review-sell').isVisible(),false);
   assert.deepEqual(await getAccount(page),account);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS phone and desktop holding review: evidence, reserved shares, draft-only transfer, confirmed sale, invalid quote gate');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
