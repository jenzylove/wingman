import { test } from "node:test";
import assert from "node:assert/strict";
import { repeatStats, splitCrew, score, median } from "./crew";
import type { CrewMember, Trade } from "../types";

const tr = (wallet: string, side: "buy" | "sell", ts: number, q = 1, amt = 100): Trade => ({
  wallet,
  side,
  ts,
  tokenAmount: amt,
  quoteAmount: q,
  quoteSymbol: "SOL",
  tx: `${wallet}-${ts}`,
});

test("repeat buyers are counted once per token, with their offset", () => {
  const buys = [
    { mint: "A", ts: 1000 },
    { mint: "B", ts: 2000 },
    { mint: "C", ts: 3000 },
  ];
  const m = new Map<string, Trade[]>([
    ["A", [tr("crew", "buy", 995), tr("crew", "buy", 999), tr("bot", "buy", 1004), tr("caller", "buy", 1000)]],
    ["B", [tr("crew", "buy", 1998), tr("bot", "buy", 2003), tr("far", "buy", 2100)]],
    ["C", [tr("bot", "buy", 3005), tr("crew", "sell", 2999)]],
  ]);
  const s = repeatStats(buys, m, new Set(["caller"]));
  assert.deepEqual(s.get("crew"), { hits: 2, of: 3, offsets: [-5, -2] });
  assert.equal(s.get("bot")?.hits, 3);
  assert.equal(s.has("far"), false);
  assert.equal(s.has("caller"), false);
});

test("crew buys with or before the caller, copy bots after", () => {
  const s = new Map([
    ["crew", { hits: 3, of: 4, offsets: [-3, 0, -1] }],
    ["bot", { hits: 4, of: 4, offsets: [2, 3, 2, 5] }],
    ["once", { hits: 1, of: 4, offsets: [-1] }],
  ]);
  const { crew, copyBots } = splitCrew(s);
  assert.deepEqual(crew.map((c) => c.wallet), ["crew"]);
  assert.deepEqual(copyBots.map((c) => c.wallet), ["bot"]);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test("insiders who bought before the post and sold after are called out with the numbers", () => {
  const t0 = 10_000;
  const insider: CrewMember = { wallet: "caller", tier: "public", evidence: "", trades: [tr("caller", "buy", t0 - 40, 2), tr("caller", "sell", t0 + 180, 5)] };
  const window = [tr("caller", "buy", t0 - 40, 2), tr("someone", "buy", t0 - 10, 2), tr("follower", "buy", t0 + 20, 3)];
  const r = score(t0, true, [insider], window, 100);
  assert.equal(r.verdict, "sold_into_followers");
  assert.equal(r.summary.firstInsiderBuyOffset, -40);
  assert.equal(r.summary.insiderNetQuote, 3);
  assert.equal(r.summary.insiderNetUsd, 300);
  assert.equal(r.coverage.earlyVolumeAttributedPct, 50);
  assert.match(r.verdictLine, /40s before the post/);
  assert.match(r.verdictLine, /3 min after the post/);
  assert.doesNotMatch(r.verdictLine, /scam/i);
});

test("holding with no sells is clean, and no known wallets is unknown", () => {
  const t0 = 5000;
  const holder: CrewMember = { wallet: "c", tier: "public", evidence: "", trades: [tr("c", "buy", t0 - 7200)] };
  assert.equal(score(t0, true, [holder], [], undefined).verdict, "clean");
  const none = score(t0, false, [], [tr("x", "buy", t0 - 5)]);
  assert.equal(none.verdict, "unknown");
  assert.equal(none.coverage.earlyVolumeAttributedPct, 0);
});

test("without a post the reference is the caller's first buy", () => {
  const t0 = 100;
  const c: CrewMember = { wallet: "c", tier: "public", evidence: "", trades: [tr("c", "buy", t0), tr("c", "sell", t0 + 400, 2)] };
  const r = score(t0, false, [c], [tr("c", "buy", t0)]);
  assert.match(r.verdictLine, /caller's first buy/);
});

test("same second co buys on two tokens count as crew; two loose ones don't", () => {
  const s = new Map([
    ["tight", { hits: 2, of: 16, offsets: [0, 1] }],
    ["loose", { hits: 2, of: 16, offsets: [0, 9] }],
  ]);
  const { crew, copyBots } = splitCrew(s);
  assert.deepEqual(crew.map((c) => c.wallet), ["tight"]);
  assert.equal(copyBots.length, 0);
});
