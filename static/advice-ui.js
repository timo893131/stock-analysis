/* Report-backed AI guidance and independent full-amount practice. Budgets stay local. */
(function(root){
'use strict';
const contexts=new Map(),drafts=new Map(),budgets=new Map();let options={};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'NT$ '+Number(n).toLocaleString('zh-TW',{maximumFractionDigits:2});
function render(ai,q){
 const key=[ai.symbol,ai.asOf,ai.generatedAt].join('|'),a=root.StockroomDecision.advice(q,ai),state=a.action==='consider'?'positive':a.action==='insufficient'?'unavailable':'caution';
 contexts.set(key,{ai,q});if(contexts.size>100){const old=contexts.keys().next().value;contexts.delete(old);drafts.delete(old);}
 const draft={...(drafts.get(key)||{value:budgets.get(ai.symbol)||'',html:''})};if(draft.action!==a.action){draft.html='';draft.preview='';}
 return `<section class="ai-action" data-state="${state}" data-advice-key="${esc(key)}"><span class="status-badge">${state==='positive'?'可列入研究':state==='caution'?'先留意風險':'資料待確認'}</span><h3>${esc(a.label)}</h3><p><b>簡短原因：</b>${esc(a.reason)}</p><p class="report-date">${esc(q?.name||ai.symbol)}；行情日 ${esc(q?.tradeDate||'未提供')}。AI 使用日收盤，不是即時報價。</p><form class="ai-size-form" novalidate><label>本次可使用的預算（NT$）<input type="text" class="ai-budget" inputmode="numeric" autocomplete="off" maxlength="30" placeholder="例如 30,000" value="${esc(draft.value)}"></label><p class="budget-preview" aria-live="polite">${esc(draft.preview||'輸入金額，分開看「照你的金額買」與「AI 建議先投入多少」。')}</p><div class="budget-presets"><button class="outline" type="button" data-amount="10000">1 萬元</button><button class="outline" type="button" data-amount="30000">3 萬元</button><button class="outline" type="button" data-amount="100000">10 萬元</button><button class="outline" type="button" data-amount="paper">帶入虛擬餘額</button></div><button class="green-button" type="submit">換算金額與股數</button></form><div class="ai-size" role="status" aria-live="polite" aria-atomic="true">${draft.html||'<p>尚未試算。手動練習會照你的金額換算，不套用單檔 10% 或首筆 30% 限制。</p>'}</div><button class="outline journal-capture" type="button" data-record-advice>保存這次判斷，之後回顧</button><details class="size-assumptions"><summary>金額與 AI 建議怎麼看？</summary><p>手動換算以這筆完整金額、每股收盤、不利滑價與買入費用算整數股，剩餘金額不會硬湊一股。AI 比例只有模型實際回覆才顯示；建議觀察或暫不買入時，AI 新增買入參考為 0。金額由本機換算，不會送給 AI，也不會限制自由練習或自動下單。</p></details></section>`;
}
function calculate(card){
 const ctx=contexts.get(card.dataset.adviceKey);if(!ctx)throw Error('這份報告已更新，請重新開啟解析。');
 const q=options.getQuote?.(ctx.ai.symbol)||ctx.q,budget=root.StockroomDecision.parseBudget(card.querySelector('.ai-budget').value);
 return {ctx,q,budget,manual:root.StockroomDecision.cashPlan(q,budget),suggested:root.StockroomDecision.entryPlan(q,ctx.ai,budget)};
}
function update(card){
 const key=card.dataset.adviceKey,input=card.querySelector('.ai-budget'),target=card.querySelector('.ai-size'),ctx=contexts.get(key);let html,preview;
 try{
  const {q,budget,manual:r,suggested:s}=calculate(card);preview=`照你的金額換算：${r.shares} 股，含費用 ${money(r.cost)}，剩餘 ${money(r.left)}`;
  html=`<section class="manual-purchase"><h4>照你的金額買入（自行決定）</h4><div class="sizing-result"><div><span>換算股數</span><strong>${r.shares} 股</strong></div><div><span>含費用金額</span><strong>${money(r.cost)}</strong></div><div><span>未使用金額</span><strong>${money(r.left)}</strong></div><div><span>試算每股價（含滑價）</span><strong>${money(r.price)}</strong></div></div><p>${r.shares?'依完整預算換算，沒有額外比例限制。':'金額不足買 1 股（含費用），因此是 0 股。'}</p><button type="button" class="outline" data-practice-advice ${r.shares?'':'disabled'}>用我的金額做虛擬練習</button></section><section class="ai-allocation"><h4>AI 建議投入參考</h4><p>${s.allocationPct?`AI 回覆先使用預算的 ${s.allocationPct}%，約 ${money(s.cost)}／${s.shares} 股。`:s.allocationPct===0?'目前 AI 新增買入參考：NT$ 0。':'這份 AI 尚未提供投入比例。'}</p><p>${esc(s.reason)}</p>${s.shares?'<button type="button" class="outline" data-practice-ai>依 AI 參考金額練習</button>':''}<small>建議不是限制。是否買入與金額仍由你決定；這是研究參考，不是上漲保證。</small></section><small>手動試算使用 ${esc(q.tradeDate||root.StockroomPaper.day(q.asOf*1000))} 已取得收盤。確認虛擬委託後才建立持倉。</small>`;
  target.dataset.state='info';
 }catch(error){preview=error.message;html=`<p class="calculation-error">${esc(error.message)}</p>`;target.dataset.state='caution';}
 target.innerHTML=html;card.querySelector('.budget-preview').textContent=preview;if(ctx)budgets.set(ctx.ai.symbol,input.value);drafts.set(key,{value:input.value,html,preview,action:root.StockroomDecision.advice(ctx?.q,ctx?.ai).action});
}
function configure(value){options=value;}
document.addEventListener('submit',e=>{if(!e.target.matches('.ai-size-form'))return;e.preventDefault();const card=e.target.closest('.ai-action');update(card);card.querySelector('.ai-budget').blur();card.querySelector('.ai-size').scrollIntoView({behavior:'smooth',block:'nearest'});});
for(const event of ['input','change'])document.addEventListener(event,e=>{if(e.target.matches('.ai-budget')){const card=e.target.closest('.ai-action');if(event==='change'&&drafts.get(card.dataset.adviceKey)?.value===e.target.value)return;update(card);}});
document.addEventListener('click',e=>{
 const practice=e.target.closest('[data-practice-advice],[data-practice-ai]');if(practice){const card=practice.closest('.ai-action');try{const r=calculate(card),amount=practice.hasAttribute('data-practice-ai')?r.suggested.allocation:r.budget;if(!amount||practice.hasAttribute('data-practice-ai')&&!r.suggested.shares)throw Error('目前沒有可帶入的 AI 金額。');options.practice?.(r.q.symbol,amount);}catch(error){card.querySelector('.budget-preview').textContent=error.message;}return;}
 const capture=e.target.closest('[data-record-advice]');if(capture){const ctx=contexts.get(capture.closest('.ai-action').dataset.adviceKey);if(ctx)document.dispatchEvent(new CustomEvent('stockroom:record',{detail:{quote:ctx.q,ai:ctx.ai}}));return;}
 const button=e.target.closest('[data-amount]');if(!button)return;const card=button.closest('.ai-action');if(!card)return;const amount=button.dataset.amount==='paper'?Math.floor(options.getAvailable?.()||0):button.dataset.amount;card.querySelector('.ai-budget').value=String(amount);update(card);
});
root.StockroomAdviceUI={render,configure};
})(globalThis);
