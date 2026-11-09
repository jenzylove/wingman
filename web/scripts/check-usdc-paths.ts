// Pushes real recent trades through each quote path and checks they carry value and the right side.
import * as base from "../src/lib/engine/base";
import { tokenTxsBetween, tradeOf, solUsd } from "../src/lib/engine/sol";
import { tradeValue } from "../src/lib/engine/crew";
import type { Trade } from "../src/lib/types";
const show = (label: string, ts: Trade[], q?: number) => {
  const usdc = ts.filter((t) => t.usd && !t.quoteAmount);
  const mixed = ts.filter((t) => t.usd && t.quoteAmount);
  const zero = ts.filter((t) => tradeValue(t, q) === 0);
  console.log(`${label}: ${ts.length} trades, ${usdc.length} USDC only, ${mixed.length} mixed, ${zero.length} with zero value, quoteUsd=${q}`);
  for (const t of usdc.slice(0, 3)) console.log("  usdc", t.side, t.tokenAmount.toFixed(2), "usd", t.usd?.toFixed(2), "-> value", tradeValue(t, q).toFixed(6), t.tx);
  for (const t of zero.slice(0, 2)) console.log("  ZERO", t.side, t.tx);
  for (const t of mixed.slice(0, 5)) console.log("  mixed", t.side, "sol", t.quoteAmount.toFixed(6), "usd", t.usd?.toFixed(2), t.tx);
};
(async () => {
  const now = Math.floor(Date.now() / 1000);
  const a = base.adapter as any;
  const aero = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";
  const bq = await a.quoteUsd();
  show("Base AERO", await a.windowTrades(aero, now - 240, now), bq);
  const jup = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
  const sq = await solUsd();
  const txs = await tokenTxsBetween(jup, now - 120, now, 2);
  show("Solana JUP", txs.map((t) => tradeOf(t, jup)).filter(Boolean) as Trade[], sq);
})();
