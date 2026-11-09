/* Deterministic educational backtest. Original implementation, no vendor code. */
(function (root) {
  'use strict';
  function run(history, options = {}) {
    const period = options.period ?? 20;
    const allocation = options.allocation ?? 0.2;
    const initial = options.initial ?? 1000000;
    const feeRate = 0.001425, taxRate = options.etf ? 0.001 : 0.003;
    const slippage = 0.001; // 0.1% adverse fill on each side
    if (![20, 60].includes(period) || ![0.2, 0.5, 1].includes(allocation) || !Number.isFinite(initial) || initial <= 0)
      throw new Error('回測參數無效。');
    if (!Array.isArray(history) || history.length < period + 20)
      throw new Error(`至少需要 ${period + 20} 筆收盤資料（含 ${period} 日暖機）。`);
    history.forEach((bar, i) => {
      if (!Number.isFinite(bar.close) || bar.close <= 0 || !Number.isFinite(bar.time) || (i && bar.time <= history[i-1].time))
        throw new Error('行情必須是依日期遞增、無重複且價格大於零的資料。');
    });
    function simulate(buyHold) {
      let cash = initial, shares = 0, basis = 0, pending = null, peak = initial, maxDrawdown = 0, fees = 0;
      const trades = [], closed = [], curve = [];
      // The signal at period-1 can only fill on period, never the same bar.
      for (let i = period - 1; i < history.length; i++) {
        const bar = history[i], last = i === history.length - 1;
        if (pending && !(last && pending.side === 'buy')) {
          if (pending.side === 'buy' && !shares) {
            const fill = bar.close * (1 + slippage);
            const budget = cash * allocation;
            const qty = Math.floor(budget / (fill * (1 + feeRate)));
            if (qty > 0) {
              const fee = qty * fill * feeRate;
              basis = qty * fill + fee;
              cash -= basis; shares = qty; fees += fee;
              trades.push({time:bar.time, signalTime:pending.time, side:'buy', price:fill, quantity:qty, fee, tax:0, reason:'前一日訊號'});
            }
          } else if (pending.side === 'sell' && shares) {
            sell(bar, pending.time, '前一日訊號');
          }
        }
        pending = null;
        // End-of-sample liquidation is explicit and included in both comparisons.
        if (last && shares) sell(bar, null, '期末結算');
        if (i >= period) {
          const equity = cash + shares * bar.close;
          peak = Math.max(peak, equity);
          maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
          curve.push({time:bar.time, equity, drawdown:(peak-equity)/peak});
        }
        if (!last) {
          const ma = history.slice(i-period+1, i+1).reduce((sum,x)=>sum+x.close,0)/period;
          if (buyHold) {
            if (i === period-1) pending = {side:'buy', time:bar.time};
          } else if (!shares && bar.close > ma * 1.01) pending = {side:'buy',time:bar.time};
          else if (shares && bar.close < ma * 0.99) pending = {side:'sell',time:bar.time};
        }
      }
      function sell(bar, signalTime, reason) {
        const fill = bar.close * (1-slippage), gross = shares * fill;
        const fee = gross * feeRate, tax = gross * (options.bond && new Date(bar.time*1000).toISOString().slice(0,10)<='2026-12-31'?0:taxRate);
        const pnl = gross-fee-tax-basis;
        cash += gross-fee-tax; fees += fee+tax; closed.push(pnl);
        trades.push({time:bar.time,signalTime,side:'sell',price:fill,quantity:shares,fee,tax,pnl,reason});
        shares = 0; basis = 0;
      }
      return {finalEquity:cash, totalReturn:cash/initial-1,maxDrawdown,fees,roundTrips:closed.length,
        winRate:closed.length?closed.filter(x=>x>0).length/closed.length:null,trades,curve};
    }
    return {strategy:simulate(false), benchmark:simulate(true),period,allocation,initial,
      start:history[period].time,end:history.at(-1).time,bars:history.length-period,
      execution:'next_close',feeRate,taxRate,bond:!!options.bond,slippage};
  }
  if (typeof module !== 'undefined') module.exports = {run};
  else root.StockroomBacktest = {run};
})(typeof globalThis !== 'undefined' ? globalThis : this);
