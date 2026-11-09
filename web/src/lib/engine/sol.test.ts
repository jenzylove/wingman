import { test } from "node:test";
import assert from "node:assert/strict";
import { tradeOf } from "./sol";

const WSOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const ME = "Me11111111111111111111111111111111111111111";
const POOL = "Pool1111111111111111111111111111111111111111";
const tx = (transfers: { mint: string; amt: number; from: string; to: string }[], nativeChange = -5000) => ({
  signature: "sig",
  timestamp: 1,
  feePayer: ME,
  fee: 5000,
  tokenTransfers: transfers.map((x) => ({ mint: x.mint, tokenAmount: x.amt, fromUserAccount: x.from, toUserAccount: x.to })),
  accountData: [{ account: ME, nativeBalanceChange: nativeChange }],
});

test("a buy paid with already wrapped SOL is priced by the WSOL leg", () => {
  const t = tradeOf(tx([{ mint: WSOL, amt: 0.25, from: ME, to: POOL }, { mint: MINT, amt: 88, from: POOL, to: ME }]) as never, MINT)!;
  assert.equal(t.side, "buy");
  assert.ok(Math.abs(t.quoteAmount - 0.25) < 1e-9);
});

test("a bot that only collects tokens, SOL and USDC is not a trade", () => {
  const t = tradeOf(
    tx([
      { mint: MINT, amt: 107, from: POOL, to: ME },
      { mint: WSOL, amt: 0.31, from: POOL, to: ME },
      { mint: USDC, amt: 26.86, from: POOL, to: ME },
    ]) as never,
    MINT,
  );
  assert.equal(t, null);
});

test("a USDC buy counts the dollars once and no SOL", () => {
  const t = tradeOf(tx([{ mint: USDC, amt: 50, from: ME, to: POOL }, { mint: MINT, amt: 200, from: POOL, to: ME }]) as never, MINT)!;
  assert.equal(t.side, "buy");
  assert.equal(t.usd, 50);
  assert.equal(t.quoteAmount, 0);
});
