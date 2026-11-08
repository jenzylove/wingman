import { adapter } from "../src/lib/engine/base";
(async () => {
  const crew = "0xC25A0c3c6c3c941cb2010Acf58C62F72124b1d17", degen = "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed";
  const w = await adapter.walletTrades(crew, degen, 1794172990, 1794173100);
  console.log("wallet", w.map((t) => [t.side, t.tx.slice(0, 10), t.quoteAmount.toFixed(6), t.tokenAmount.toFixed(1)]));
  const all = await adapter.windowTrades(degen, 1794173000, 1794173100);
  console.log("window has crew:", all.filter((t) => t.wallet === crew.toLowerCase()).map((t) => [t.side, t.tx.slice(0, 10)]), "total", all.length);
})();
