/* Full-market closing snapshots stay separate from stocks with verified history. */
(function(root){
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('zh-TW',{maximumFractionDigits:d}):'—';
let snapshot={quotes:[],markets:{}},page=0,options={},mode='all',manualMode=false,opening=false;const pageSize=30;
function setMode(next){mode=next;const all=next==='all';$('#full-market').classList.toggle('hidden',!all);$('#overview-view .content-grid').classList.toggle('hidden',all);document.querySelectorAll('[data-market-mode]').forEach(b=>{const active=b.dataset.marketMode===next;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
function render(){
 const term=$('#full-search').value.trim().toLowerCase(),market=$('#full-market-filter').value,sort=$('#full-sort').value;
 const rows=snapshot.quotes.filter(q=>(!term||q.symbol.toLowerCase().includes(term)||q.name.toLowerCase().includes(term))&&(!market||market==='etf'&&q.kind==='etf'||market===q.market));
 rows.sort((a,b)=>{if(sort==='code')return a.symbol.localeCompare(b.symbol);const key=sort==='volume'?'volume':'change',x=a[key],y=b[key];if(!Number.isFinite(x))return Number.isFinite(y)?1:a.symbol.localeCompare(b.symbol);if(!Number.isFinite(y))return -1;return (sort==='fall'?x-y:y-x)||a.symbol.localeCompare(b.symbol);});
 const pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages-1);
 $('#full-summary').textContent=`官方收盤快照 ${snapshot.quotes.length.toLocaleString('zh-TW')} 檔 · 上市 ${snapshot.quotes.filter(q=>q.market==='上市').length} · 上櫃 ${snapshot.quotes.filter(q=>q.market==='上櫃').length} · ETF ${snapshot.quotes.filter(q=>q.kind==='etf').length}（包含於前兩者）`;
 const sources=Object.entries(snapshot.markets).map(([key,m])=>`${key==='twse'?'上市':'上櫃'}：${m.tradeDate||'日期未提供'} ${m.status==='ready'?'來源已讀取':m.status==='cached'?'更新失敗，沿用舊快照':'來源暫缺'}${m.tradeDate&&Date.now()-Date.parse(m.tradeDate+'T13:30:00+08:00')>7*86400000?'，超過 7 天，需查核':''}`).join('；');
 $('#full-source').textContent=sources||'官方整批來源尚未可用；仍可查看已載入的研究清單。';$('#full-source').dataset.state=snapshot.status==='ready'?'info':'caution';
 $('#full-results').innerHTML=rows.slice(page*pageSize,(page+1)*pageSize).map(q=>{const valid=Number.isFinite(q.price),covered=options.hasHistory(q.symbol);return `<article class="full-quote"><div><h3>${esc(q.name)}</h3><small>${esc(q.symbol)} · ${esc(q.market)}${q.kind==='etf'?' · ETF':''}</small></div><div class="full-price"><strong>${valid?num(q.price):'待收盤價'}</strong><span class="${!Number.isFinite(q.change)?'':q.change>=0?'up':'down'}">${Number.isFinite(q.change)?`${q.change>=0?'上漲 +':'下跌 '}${num(q.change)}%`:'漲跌未提供'}</span></div><div class="full-meta"><span>成交量 ${Number.isFinite(q.volume)?num(q.volume,0)+' 股':'未提供'}</span><span>行情日 ${esc(q.tradeDate)}</span></div><span class="status-badge">${covered?'ⓘ 深度資料已載入':'ⓘ 收盤快照；歷史與 AI 按需載入'}</span><button class="outline" type="button" data-full-symbol="${esc(q.symbol)}">${covered?'開啟走勢與 AI':'載入走勢／財報／AI'} →</button></article>`;}).join('')||'<p class="empty">沒有符合的收盤快照。可調整條件，或切換「已載入深度分析」使用名錄搜尋。</p>';
 $('#full-pagination').textContent=`符合 ${rows.length} 檔 · 第 ${page+1}／${pages} 頁`;
 $('#full-prev').disabled=page===0;$('#full-next').disabled=page>=pages-1;
 const teaser=$('#full-market-teaser');if(teaser)teaser.textContent=snapshot.quotes.length?`全市場收盤 ${snapshot.quotes.length} 檔 · 查看上市／上櫃／ETF →`:'全市場來源暫缺 · 查看資料狀態 →';
}
let loading=null;
function reload(){if(loading)return loading;loading=(async()=>{
 try{const r=await fetch(root.STOCKROOM_STATIC?'./data/full-market.json':'/api/full-market',{cache:'no-store',signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.quotes))throw Error();snapshot=data;snapshot.markets||={};$('#full-action-status').textContent='';}
 catch{$('#full-action-status').textContent='無法重新讀取整批快照，保留原本資料；請查看來源日期，稍後再更新。';}
 render();
})().finally(()=>{loading=null;});return loading;}

async function init(config){options=config;document.querySelectorAll('[data-market-mode]').forEach(b=>b.onclick=()=>{manualMode=true;setMode(b.dataset.marketMode);});for(const id of ['full-search','full-market-filter','full-sort'])$('#'+id).addEventListener(id==='full-search'?'input':'change',()=>{page=0;render();});$('#full-prev').onclick=()=>{page--;render();$('#full-results').scrollIntoView({block:'start'});};$('#full-next').onclick=()=>{page++;render();$('#full-results').scrollIntoView({block:'start'});};$('#full-results').onclick=async e=>{const b=e.target.closest('[data-full-symbol]');if(!b||opening)return;opening=true;b.disabled=true;b.textContent='正在載入深度資料…';$('#full-action-status').textContent='正在取得歷史行情與可用財報，請稍候；此步驟使用共用查詢額度。';try{const ok=await options.open(b.dataset.fullSymbol);$('#full-action-status').textContent=ok===false?($('#api-status')?.textContent||'資料尚未載入，請稍後重試。'):'';}catch(error){$('#full-action-status').textContent=error.message;}finally{opening=false;render();}};
 setMode('all');
 await reload();
 render();if(!manualMode)setMode(snapshot.quotes.length?'all':'research');
}
root.StockroomMarketUI={init,render,setMode,reload,get ready(){return !!options.hasHistory;}};
})(globalThis);
