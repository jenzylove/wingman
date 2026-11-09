// DEV ONLY. Used by /dev/preview to design states without the API. Never import from real pages.
import type { ArmedExit, Card, CrewMember, Trade } from "@/lib/types";

const POST = 1793000000; // fixed fixture time

function t(wallet: string, side: Trade["side"], off: number, quote: number, n: number): Trade {
  return {
    wallet,
    side,
    ts: POST + off,
    tokenAmount: quote * 1_000_000,
    quoteAmount: quote,
    quoteSymbol: "SOL",
    usd: quote * 160,
    tx: `FIXTURE${n}${wallet.slice(0, 6)}${Math.abs(off)}xQ9`,
  };
}

const W = {
  a: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  b: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  c: "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
  d: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
  e: "3Kz9v6kFQ2rU4YHmE7FBn1t8kJcVgPZ8xyuW2y2M6s7B",
  f: "Bq5p9iZ2y9n3eJmZ8xH5o3rWtZQJ3cJd1vQe2Yz4mN8K",
  g: "8hYq3xWm2Lr5TnVb7KpQe4ZsJd6FcGu9AiMo1RtXyBvN",
  h: "4pLm7NqRs2TvWx5YzAb8CdEf3GhJk6MnPq9RsTuVwXyZ",
};

const caller: CrewMember[] = [
  {
    wallet: W.a,
    tier: "public",
    evidence: "Listed as this caller's wallet in a public KOL dataset.",
    proofUrl: "https://example.com/kol-dataset",
    firstBuyOffset: -21,
    trades: [t(W.a, "buy", -21, 4.2, 1), t(W.a, "sell", 134, 7.9, 2), t(W.a, "sell", 410, 2.1, 3)],
  },
];

const crew: CrewMember[] = [
  {
    wallet: W.b,
    tier: "behaviour",
    evidence: "Bought with this caller on 6 of 9 recent tokens, within 20s",
    repeat: { hits: 6, of: 9 },
    firstBuyOffset: -38,
    trades: [t(W.b, "buy", -38, 6.0, 4), t(W.b, "sell", 121, 10.4, 5)],
  },
  {
    wallet: W.c,
    tier: "behaviour",
    evidence: "Bought within 20s before this caller posted on 5 of 7 recent calls.",
    repeat: { hits: 5, of: 7 },
    firstBuyOffset: -12,
    trades: [t(W.c, "buy", -12, 3.1, 6), t(W.c, "buy", 4, 1.0, 7), t(W.c, "sell", 162, 6.8, 8)],
  },
  {
    wallet: W.d,
    tier: "behaviour",
    evidence: "Bought within 30s before this caller posted on 4 of 8 recent calls.",
    repeat: { hits: 4, of: 8 },
    firstBuyOffset: -6,
    trades: [t(W.d, "buy", -6, 2.0, 9)],
  },
];

const bots: CrewMember[] = [
  {
    wallet: W.e,
    tier: "behaviour",
    evidence: "Bought 2 to 5 seconds after this caller's first buy on 9 of 9 calls.",
    repeat: { hits: 9, of: 9 },
    firstBuyOffset: -17,
    trades: [t(W.e, "buy", -17, 1.5, 10), t(W.e, "sell", 95, 2.4, 11)],
  },
];

const early: CrewMember[] = [
  {
    wallet: W.g,
    tier: "early",
    evidence: "Bought 74s before this post",
    firstBuyOffset: -74,
    trades: [t(W.g, "buy", -74, 2.4, 12), t(W.g, "sell", 140, 3.9, 13)],
  },
  {
    wallet: W.h,
    tier: "early",
    evidence: "Bought 31s before this post",
    firstBuyOffset: -31,
    trades: [t(W.h, "buy", -31, 0.9, 14)],
  },
];

export const fixtureCard: Card = {
  id: "fixture-sold",
  call: {
    source: "x",
    url: "https://x.com/nightcaller/status/1",
    handle: "nightcaller",
    displayName: "Night Caller",
    text: "this one is going to send. not financial advice",
    postedAt: POST,
    token: { chain: "solana", address: "FiXtUrEm1nt111111111111111111111111111111pump", symbol: "OWL", name: "Night Owl" },
  },
  callerWallets: caller,
  crew,
  copyBots: bots,
  early,
  summary: {
    firstInsiderBuyOffset: -38,
    firstInsiderSellOffset: 121,
    insidersSold: true,
    insiderNetQuote: 18.6,
    insiderNetUsd: 2976,
    stillHoldingPct: 21,
  },
  coverage: { earlyVolumeAttributedPct: 64, note: "The other 36% came from wallets we have not tied to anyone yet." },
  verdict: "sold_into_followers",
  verdictLine: "The caller's crew bought 38s before the post and started selling 2m 1s after it.",
  computedAt: POST + 900,
};

export const fixtureEmptyCard: Card = {
  id: "fixture-empty",
  call: {
    source: "token",
    token: { chain: "base", address: "0x4200000000000000000000000000000000000006", symbol: "FIX" },
  },
  callerWallets: [],
  crew: [],
  copyBots: [],
  summary: { insidersSold: false, insiderNetQuote: 0, stillHoldingPct: 0 },
  coverage: { earlyVolumeAttributedPct: 0, note: "No caller handle was given, so there were no wallets to start from." },
  verdict: "unknown",
  verdictLine: "We could not tie any wallet to a caller for this token yet.",
  computedAt: POST,
};

export const fixtureExits: ArmedExit[] = [
  {
    id: "fx1",
    chain: "solana",
    owner: W.f,
    token: fixtureCard.call.token.address,
    watch: [W.a, W.b, W.c],
    amount: "1200000000",
    maxSlippageBps: 300,
    status: "fired",
    armedAt: POST + 10,
    trigger: { wallet: W.b, tx: "FIXTURETRIGGER1", ts: POST + 121 },
    exit: { tx: "FIXTUREEXIT1", ts: POST + 123, quoteOut: 2.36, usdOut: 377 },
  },
  {
    id: "fx2",
    chain: "base",
    owner: "0x1111111111111111111111111111111111111111",
    token: "0x4200000000000000000000000000000000000006",
    watch: ["0x2222222222222222222222222222222222222222"],
    amount: "5000000000000000000",
    maxSlippageBps: 500,
    status: "armed",
    armedAt: POST + 400,
  },
];

// Stance fixtures for /dev/preview. Checked two minutes before the page renders, so Ride opens without a recheck.
const CHECKED = Math.floor(Date.now() / 1000) - 120;
const buysOnly = (ms: CrewMember[]) => ms.map((m) => ({ ...m, trades: m.trades.filter((x) => x.side === "buy") }));

export const fixtureSelling: Card = { ...fixtureCard, id: "fixture-selling", computedAt: CHECKED };

export const fixtureIn: Card = {
  ...fixtureCard,
  id: "fixture-in",
  callerWallets: buysOnly(caller),
  crew: buysOnly(crew),
  early: buysOnly(early),
  copyBots: buysOnly(bots),
  summary: { firstInsiderBuyOffset: -38, insidersSold: false, insiderNetQuote: -18.3, insiderNetUsd: -2928, stillHoldingPct: 100 },
  verdict: "clean",
  verdictLine: "The caller's crew bought 38s before the post and has not sold yet.",
  computedAt: CHECKED,
};

export const fixtureOut: Card = {
  ...fixtureCard,
  id: "fixture-out",
  crew: crew.map((m) => (m.wallet === W.d ? { ...m, trades: [...m.trades, t(W.d, "sell", 205, 3.3, 15)] } : m)),
  early: early.map((m) => (m.wallet === W.h ? { ...m, trades: [...m.trades, t(W.h, "sell", 260, 1.4, 16)] } : m)),
  summary: { firstInsiderBuyOffset: -38, firstInsiderSellOffset: 121, insidersSold: true, insiderNetQuote: 21.9, insiderNetUsd: 3504, stillHoldingPct: 0 },
  verdict: "exited",
  verdictLine: "The caller's crew bought 38s before the post and was fully out 3m 25s after it.",
  computedAt: CHECKED,
};

export const fixtureNone: Card = { ...fixtureEmptyCard, id: "fixture-none", computedAt: CHECKED };
