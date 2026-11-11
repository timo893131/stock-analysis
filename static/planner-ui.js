(function(root){
'use strict';
const D=root.StockroomPlanner,P=root.StockroomPaper,KEY='stockroom-plans-v1';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n).toLocaleString('zh-TW',{maximumFractionDigits:2}),money=n=>'NT$ '+num(n);
let options={},book={version:1,items:[]},stored=null,locked=false,currentSymbol=null,initialized=false,result=null,hadRealQuote=false;
function read(){try{stored=localStorage.getItem(KEY);book=stored?D.validateBook(JSON.parse(stored)):{version:1,items:[]};locked=false;}catch{book={version:1,items:[]};locked=true;}}
function write(next){
 if(locked)throw Error('計畫資料無法讀取，請先下載原始備份。');
 if(localStorage.getItem(KEY)!==stored){read();shelf();throw Error('其他分頁已更新計畫，已重新讀取；請重試。');}
 const raw=JSON.stringify(D.validateBook(next));localStorage.setItem(KEY,raw);stored=raw;book=next;shelf();
}
function values(){return Object.fromEntries([...$('#plan-form').querySelectorAll('[data-plan-field]')].map(el=>[el.dataset.planField,el.value]));}
function clearResult(){result=null;$('#plan-result').innerHTML='<p>填完條件後按「檢查這份計畫」，會列出四個限制各能容納多少股。</p>';$('#plan-save').disabled=$('#plan-practice').disabled=true;}
function calculate(){
 try{
  const q=options.quote();result=D.calculate(values(),q,options.account());
  const labels={loss:'你能承受的單筆損失',position:'單檔部位上限（含既有持股）',order:'這次委託的金額上限',cash:'保留現金後可用的資金'};
  $('#plan-result').innerHTML=`<div class="plan-verdict" data-state="${result.allowed?'info':'caution'}"><h3>${result.allowed?'符合你設定的計畫條件':'先調整計畫，暫不帶入委託'}</h3><p>${result.allowed?'通過只代表沒有超過你的限制，不是 AI 買入建議。':result.reasons.map(esc).join(' ')}</p></div><dl class="plan-key-figures"><div><dt>條件容納的股數</dt><dd>${num(result.shares)} 股</dd></div><div><dt>試算金額（含買入費用）</dt><dd>${money(result.reserved)}</dd></div><div><dt>假設停損時損失</dt><dd>${money(result.loss)}</dd></div><div><dt>費稅後賺賠比</dt><dd>${num(result.rr)}：1</dd></div></dl><details class="plan-math"><summary>為什麼是這個股數？</summary><ul>${Object.entries(result.caps).map(([k,n])=>`<li><span>${labels[k]}</span><b>${num(n)} 股${result.binding.includes(k)?'（限制來源）':''}</b></li>`).join('')}</ul><p>計算包含買賣費用、賣出交易稅及賣出不利滑價。買入以最高買價與已知收盤價中的較高者衡量風險。${result.usesHigherReference?'目前收盤高於你的買入價，限價可能不成交；不會自動提高限價。':''}</p></details><p class="fine-print">停損與目標只是你的計畫，這裡不會建立自動停損單。跳空、費率變動或延遲成交，可能讓實際損失超過試算。</p>`;
  $('#plan-error').textContent='';$('#plan-message').textContent='';$('#plan-save').disabled=!result.allowed||locked;$('#plan-practice').disabled=!result.allowed||root.StockroomShell.offline;return result;
 }catch(error){clearResult();$('#plan-error').textContent=error.message;return null;}
}
function refresh(){
 if(!initialized)return;
 const q=options.quote();
 if(currentSymbol!==q?.symbol){currentSymbol=q?.symbol;hadRealQuote=false;$('#plan-form').reset();$('#plan-entry').value=q?.demo===false?q.price:'';clearResult();$('#plan-error').textContent='';}
 if(q?.demo===false&&!hadRealQuote){if(!$('#plan-entry').value)$('#plan-entry').value=q.price;hadRealQuote=true;}
 $('#plan-source').textContent=q?.demo===false?`${q.name} ${q.symbol}；參考收盤 ${money(q.price)}；${P.day(q.asOf*1000)}。使用日收盤資料，沒有盤中訊號。`:'請先從「找股票」載入真實日收盤，再建立練習計畫。';
 if(result&&(result.quoteAt!==q?.asOf||result.referencePrice!==q?.price)){clearResult();$('#plan-error').textContent='行情已更新，原本輸入保留；請重新檢查計畫。';}
 shelf();
}
function shelf(){
 if(!initialized)return;
 const list=$('#plan-saved-items');
 $('#plan-count').textContent=locked?'原始資料需要檢查':`${book.items.length} / 50 份保存在此瀏覽器`;
 list.innerHTML=locked?'<p role="alert">既有計畫無法讀取，已停止寫入。請先下載原始備份；匯入有效備份可在確認後還原。</p>':book.items.slice(0,5).map(p=>{const q=options.quotes().find(q=>q.symbol===p.symbol),o=D.observation(p,q);return `<article class="saved-plan"><div><h3>${esc(p.name)} <small>${esc(p.symbol)}</small></h3><span>${num(p.shares)} 股的原始計畫</span></div><p>買入 ${num(p.inputs.entry)}／停損 ${num(p.inputs.stop)}／目標 ${num(p.inputs.target)}</p><p class="saved-plan-status" data-state="${o.state==='stop'?'caution':'info'}">${esc(o.text)}</p><small>記錄 ${esc(new Date(p.createdAt).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'}))}，當時行情 ${P.day(p.quoteAt*1000)}。只是收盤條件比較，不是已實現損益，也不會自動交易。</small><div class="saved-plan-actions"><button type="button" class="outline" data-revisit-plan="${esc(p.symbol)}">重新研究</button><button type="button" class="outline" data-remove-plan="${esc(p.id)}">移除計畫</button></div></article>`;}).join('')||'<p>還沒有保存計畫。從個股的「練習計畫」開始，先寫下風險，再決定是否練習。</p>';
 if(book.items.length>5)list.insertAdjacentHTML('beforeend','<p>顯示最近 5 份；下載備份可查看全部計畫。</p>');
}
function download(){const blob=new Blob([locked?(stored||''):JSON.stringify(book,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='stockroom-plans-'+P.day(Date.now())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function init(config){
 options=config;read();
 const panel=document.createElement('section');panel.id='plan-panel';panel.className='panel hidden';panel.innerHTML=`<div class="panel-heading"><div><h2>先寫計畫，再開始練習</h2><p>買多少，先由可承受的損失決定。</p></div></div><p id="plan-source"></p><form id="plan-form"><fieldset><legend>1. 你的價格計畫</legend><div class="plan-fields"><label>最高買入價（每股，必填）<input id="plan-entry" data-plan-field="entry" name="entry" type="number" step="0.01" min="0.01" max="10000000" required inputmode="decimal"></label><label>假設停損價（必填）<input data-plan-field="stop" name="stop" type="number" step="0.01" min="0.01" max="10000000" required inputmode="decimal"></label><label>你的觀察目標價（必填）<input data-plan-field="target" name="target" type="number" step="0.01" min="0.01" max="10000000" required inputmode="decimal"></label></div><p>價格由你設定。目標不是預測，停損不保證能照價賣出。</p></fieldset><fieldset><legend>2. 限定這次能用多少</legend><div class="plan-fields"><label>這套計畫的資金總額（NT$，必填）<input data-plan-field="budget" name="budget" type="number" min="0.01" max="1000000000" step="0.01" required inputmode="decimal"></label><label>單筆可承受損失（NT$，必填）<input data-plan-field="maxLoss" name="maxLoss" type="number" min="0.01" max="1000000000" step="0.01" required inputmode="decimal"></label><label>這次委託金額上限（NT$，必填）<input data-plan-field="maxOrder" name="maxOrder" type="number" min="0.01" max="1000000000" step="0.01" required inputmode="decimal"></label></div><button type="button" class="outline" id="plan-use-cash">帶入虛擬可用餘額</button><details class="plan-limits"><summary>部位與現金限制（可調整）</summary><div class="plan-fields"><label>單檔部位最多占總額 %<input data-plan-field="positionPct" name="positionPct" type="number" min="1" max="100" value="25" required></label><label>至少保留現金 %<input data-plan-field="bufferPct" name="bufferPct" type="number" min="0" max="95" value="10" required></label><label>最低費稅後賺賠比<input data-plan-field="minRR" name="minRR" type="number" min="0.1" max="10" step="0.1" value="1" required></label></div><p>初始值是工具範例，可依練習目的修改；並非針對你的建議。</p></details></fieldset><p id="plan-error" role="alert"></p><button class="green-button compact" type="submit">檢查這份計畫</button></form><div id="plan-result" aria-live="polite"></div><div class="plan-actions"><button id="plan-save" class="outline" type="button" disabled>保存計畫</button><button id="plan-practice" class="outline" type="button" disabled>帶入虛擬委託草稿</button></div><p id="plan-message" role="status"></p>`;
 $('#detail-view').append(panel);const tab=document.createElement('button');tab.id='jump-plan';tab.className='outline';tab.dataset.detailTab='plan';tab.type='button';tab.textContent='練習計畫';tab.onclick=()=>options.show();$('.detail-actions').append(tab);
 const saved=document.createElement('section');saved.className='panel plan-library';saved.innerHTML='<div class="panel-heading"><div><h2>我的練習計畫</h2><p id="plan-count"></p></div><button type="button" class="outline" id="plan-start">新增計畫</button></div><div id="plan-saved-items"></div><details class="plan-backups"><summary>計畫備份與來源說明</summary><p>只存在目前瀏覽器，不上傳給 AI。備份與虛擬帳戶、研究日記分開；保存不等於買入。參考 Day Trader 的部位與風險檢查方法，依台股日收盤、費稅與現有帳戶規則重新實作。</p><button type="button" class="outline" id="plan-export">下載計畫備份</button><label class="outline" tabindex="0" role="button">匯入計畫備份<input id="plan-import" type="file" accept="application/json" hidden></label></details><p id="plan-backup-message" role="status"></p>';
 $('#home-view').append(saved);initialized=true;refresh();
 $('#plan-form').onsubmit=e=>{e.preventDefault();calculate();};$('#plan-form').oninput=()=>{clearResult();$('#plan-error').textContent='';$('#plan-message').textContent='條件已變更，請重新檢查。';};
 $('#plan-use-cash').onclick=()=>{try{const a=options.account(),cash=Math.floor(a.cash-P.reserves(a).cash);$('[data-plan-field=budget]').value=cash;clearResult();$('#plan-message').textContent='只帶入虛擬餘額，仍需自行填入可承受損失與委託上限。';}catch(e){$('#plan-error').textContent=e.message;}};
 $('#plan-save').onclick=()=>{const r=calculate();if(!r?.allowed)return;try{write(D.record(book,r,crypto.randomUUID()));$('#plan-message').textContent='已保存原始計畫，可在總覽回顧；沒有送出委託。';$('#plan-save').disabled=true;}catch(e){$('#plan-message').textContent=e.message;}};
 $('#plan-practice').onclick=()=>{if(root.StockroomShell.offline){$('#plan-message').textContent='離線時不能建立新的委託草稿。';return;}const r=calculate();if(r?.allowed)try{options.practice(r);$('#plan-message').textContent='已帶入草稿，請在委託表單確認後再送出。';}catch(e){$('#plan-message').textContent=e.message;}};
 $('#plan-start').onclick=()=>options.show();$('#plan-export').onclick=download;
 saved.onclick=e=>{const open=e.target.closest('[data-revisit-plan]'),remove=e.target.closest('[data-remove-plan]');if(open)void options.open(open.dataset.revisitPlan);if(remove&&confirm('移除這份觀察計畫？不會取消虛擬委託或賣出持股。'))try{write({version:1,items:book.items.filter(p=>p.id!==remove.dataset.removePlan)});}catch(error){$('#plan-backup-message').textContent=error.message;}};
 $('#plan-import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>500000)throw Error('計畫備份不可超過 500 KB。');const incoming=D.validateBook(JSON.parse(await f.text()));if(!confirm('匯入將取代計畫清單，請先備份。虛擬帳戶與研究日記不受影響，確定匯入？'))return;const latest=localStorage.getItem(KEY);if(latest!==stored){read();shelf();throw Error('其他分頁已更新資料，請重新確認匯入。');}const raw=JSON.stringify(incoming);localStorage.setItem(KEY,raw);stored=raw;book=incoming;locked=false;shelf();$('#plan-backup-message').textContent='計畫已還原；不會自動建立任何委託。';}catch(error){$('#plan-backup-message').textContent='匯入失敗：'+error.message;}finally{e.target.value='';}};
 const label=$('#plan-import').parentElement;label.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#plan-import').click();}};
 window.addEventListener('storage',e=>{if(e.key===KEY){read();shelf();clearResult();$('#plan-message').textContent='其他分頁已更新計畫，請重新檢查。';}});
}
root.StockroomPlannerUI={init,refresh};
})(globalThis);
