/* Compact phone-first entry to the existing full-market screen and analysis. */
(function(root){
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let options={},initialized=false,opening=false;
function refresh(){
 if(!initialized)return;
 const r=root.StockroomScreener.screen(options.snapshot());
 $('#hub-coverage').textContent=r.valid?`${r.tradeDate} 收盤，已核對 ${r.valid.toLocaleString('zh-TW')} / ${r.total.toLocaleString('zh-TW')} 檔。${r.sourceComplete?'上市與上櫃來源已讀取。':'來源或日期部分缺漏，僅代表已列出的範圍。'}`:'正在等可核對的全市場收盤；可先搜尋熟悉的股票。';
 $('#hub-focus').innerHTML=r.candidates.slice(0,3).map(q=>`<li><div><b>${esc(q.name)}</b><small>${esc(q.symbol)}／${q.kind==='etf'?'ETF':q.market}／${esc(q.tradeDate)}</small><span>${q.price.toLocaleString('zh-TW')} 元，${q.change>=0?'上漲 +':'下跌 '}${q.change.toFixed(2)}%</span><small>${esc(options.analysis(q)||'價量通過初選，歷史與 AI 仍須複核')}</small></div><button type="button" class="outline" data-hub-stock="${esc(q.symbol)}">看分析</button></li>`).join('')||'<li>目前沒有符合初選的股票，先觀察也可以。不會用固定少數股票替代全市場。</li>';
 $('#hub-more').textContent=`查看全部候選（${r.candidates.length} 檔）`;
}
function init(config){
 options=config;const box=document.createElement('section');box.id='beginner-hub';box.className='panel beginner-hub';box.innerHTML='<div class="panel-heading"><div><h2>今天先看這裡</h2><p>掌握重點，再決定要不要練習。</p></div></div><div class="hub-tasks"><button type="button" class="outline" id="hub-search">找股票</button></div><p id="hub-coverage" role="status"></p><h3>值得留意的價量候選</h3><p class="fine-print">從全市場初選，先列成交金額較高的 3 檔；不等於 AI 買入推薦。</p><ol id="hub-focus"></ol><button type="button" class="outline" id="hub-more">查看全部候選</button><p id="hub-message" role="status"></p>';
 $('#home-view').prepend(box);const tasks=box.querySelector('.hub-tasks');$('#brief-run').textContent='全市場 AI';tasks.append($('#brief-run'));const practice=$('#home-view .menu-shortcuts [data-go=portfolio]');if(practice){practice.textContent='虛擬投資';tasks.append(practice);}$('#hub-search').onclick=()=>root.StockroomShell.openSearch();$('#hub-more').onclick=()=>$('#quick-panel').scrollIntoView({behavior:'smooth',block:'start'});
 box.onclick=async e=>{const b=e.target.closest('[data-hub-stock]');if(!b||opening)return;opening=true;b.disabled=true;$('#hub-message').textContent='正在開啟行情與可讀取的分析…';try{await options.open(b.dataset.hubStock);$('#hub-message').textContent='';}catch(error){$('#hub-message').textContent=error.message;}finally{opening=false;refresh();}};
 initialized=true;refresh();
}
root.StockroomBeginnerUI={init,refresh};
})(globalThis);
