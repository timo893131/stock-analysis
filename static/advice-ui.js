/* Each calculator uses the report it displays; money never leaves this browser. */
(function(root){
'use strict';
const contexts=new Map(),drafts=new Map(),budgets=new Map();let options={};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'NT$ '+Math.round(n).toLocaleString('zh-TW');
function render(ai,q){
 const key=[ai.symbol,ai.asOf,ai.generatedAt].join('|'),a=root.StockroomDecision.advice(q,ai),state=a.action==='consider'?'positive':a.action==='insufficient'?'unavailable':'caution';
 contexts.set(key,{ai,q});if(contexts.size>100){const old=contexts.keys().next().value;contexts.delete(old);drafts.delete(old);}
 const draft={...(drafts.get(key)||{value:budgets.get(ai.symbol)||'',html:''})};if(draft.action!==a.action){draft.html='';draft.preview='';}
 return `<section class="ai-action" data-state="${state}" data-advice-key="${esc(key)}"><span class="status-badge">${state==='positive'?'✓ 條件式考慮':state==='caution'?'! 需要留意':'○ 資料待確認'}</span><span class="tag">AI 買入參考 · 日收盤研究</span><h3>${esc(a.label)}</h3><p><b>簡短原因：</b>${esc(a.reason)}</p><p class="report-date">依據：${esc(q?.name||ai.symbol)} · 行情日 ${esc(q?.tradeDate||'未提供')}。底色表示研究狀態，不表示漲跌或保證獲利。</p><button class="outline journal-capture" type="button" data-record-advice>保存這次判斷，之後回顧</button><form class="ai-size-form" novalidate><label>① 總可用投資資金（跨所有股票，NT$）<input type="text" class="ai-budget" inputmode="numeric" autocomplete="off" maxlength="30" placeholder="例如 10,000" value="${esc(draft.value)}"></label><p class="budget-preview" aria-live="polite">${esc(draft.preview||'輸入後會在這裡顯示即時試算；按計算可定位完整結果。')}</p><div class="budget-presets"><button class="outline" type="button" data-amount="10000">1 萬元</button><button class="outline" type="button" data-amount="30000">3 萬元</button><button class="outline" type="button" data-amount="100000">10 萬元</button><button class="outline" type="button" data-amount="paper">帶入虛擬餘額</button></div><button class="green-button" type="submit">② 計算第一筆買入金額</button></form><div class="ai-size" role="status" aria-live="polite" aria-atomic="true">${draft.html||`<p>${a.action==='consider'?'尚未試算：輸入資金後按計算，結果會出現在這裡。':'目前新增買入試算為 0 元；輸入資金後仍會說明原因。'}</p>`}</div><details class="size-assumptions"><summary>金額怎麼算？</summary><p>單檔最多資金 10%、假設停損 8%、可承受損失 1%，第一筆取計算股數上限的 30%；含費稅與滑價。試算由固定公式計算，不是 AI 猜測金額。停損不保證成交。資金只在本瀏覽器使用，不會送給 AI，也不會自動下單。</p></details></section>`;
}
function update(card){
 const key=card.dataset.adviceKey,input=card.querySelector('.ai-budget'),target=card.querySelector('.ai-size'),ctx=contexts.get(key);let html,preview;
 try{
  const budget=root.StockroomDecision.parseBudget(input.value);
  if(!ctx)throw Error('這份報告已更新，請重新開啟解析。');
  const latest=options.getQuote?.(ctx.ai.symbol);
  if(latest&&latest.asOf!==ctx.q?.asOf)throw Error('行情已更新，這份解析的日期已不符。請先重新解析。');
  const r=root.StockroomDecision.entryPlan(ctx.q,ctx.ai,budget),left=budget-r.cost;preview=`即時試算：${r.shares} 股 · 約 ${money(r.cost)}${r.shares?'':'（目前不新增買入）'}`;
  html=`<p class="calculation-label">✓ 已完成試算 · 可用資金 ${money(budget)}</p><div class="sizing-result"><div><span>第一筆股數</span><strong>${r.shares} 股</strong></div><div><span>預估買入金額（含費用）</span><strong>${money(r.cost)}</strong></div><div><span>保留資金</span><strong>${money(left)}</strong></div><div><span>模型估計損失</span><strong>${money(r.loss)}</strong></div></div><p>${esc(r.reason)}</p>${r.shares?'<small>這是第一筆小額試算，非投入全部資金；實際成交價與損失可能不同。</small>':'<small>0 股不是計算失敗，表示目前不新增買入、資料不足或分批預算不足一股。</small>'}`;
  target.dataset.state=r.shares?'info':'caution';
 }catch(error){preview=error.message;html=`<p class="calculation-error">! ${esc(error.message)}</p>`;target.dataset.state='caution';}
 target.innerHTML=html;card.querySelector('.budget-preview').textContent=preview;if(ctx)budgets.set(ctx.ai.symbol,input.value);drafts.set(key,{value:input.value,html,preview,action:root.StockroomDecision.advice(ctx?.q,ctx?.ai).action});
}
function configure(value){options=value;}
document.addEventListener('submit',e=>{if(!e.target.matches('.ai-size-form'))return;e.preventDefault();const card=e.target.closest('.ai-action');update(card);card.querySelector('.ai-budget').blur();card.querySelector('.ai-size').scrollIntoView({behavior:'smooth',block:'nearest'});});
for(const event of ['input','change'])document.addEventListener(event,e=>{if(e.target.matches('.ai-budget'))update(e.target.closest('.ai-action'));});
document.addEventListener('click',e=>{const capture=e.target.closest('[data-record-advice]');if(capture){const ctx=contexts.get(capture.closest('.ai-action').dataset.adviceKey);if(ctx)document.dispatchEvent(new CustomEvent('stockroom:record',{detail:{quote:ctx.q,ai:ctx.ai}}));return;}const button=e.target.closest('[data-amount]');if(!button)return;const card=button.closest('.ai-action');if(!card)return;const amount=button.dataset.amount==='paper'?Math.floor(options.getAvailable?.()||0):button.dataset.amount;card.querySelector('.ai-budget').value=String(amount);update(card);});
root.StockroomAdviceUI={render,configure};
})(globalThis);
