// Shared contract between the engine, the API and the UI.

export type Chain = "solana" | "base";

// How we know a wallet belongs to the caller.
export type Tier =
  | "claimed" // caller signed from this wallet
  | "public" // publicly linked (KOL dataset, Basename, Farcaster verified)
  | "funded" // funded directly by a known caller wallet
  | "behaviour" // repeat early buyer on this caller's calls
  | "early"; // bought in the minutes right before this post (not tied to the caller)

export interface Trade {
  wallet: string;
  side: "buy" | "sell";
  ts: number; // unix seconds
  tokenAmount: number;
  quoteAmount: number; // SOL on Solana, ETH on Base
  quoteSymbol: "SOL" | "ETH";
  usd?: number;
  tx: string; // signature or hash
}

export interface CrewMember {
  wallet: string;
  tier: Tier;
  evidence: string; // plain words, e.g. "bought within 20s of this caller on 4 of 8 tokens"
  proofUrl?: string; // link to the source or a transaction
  repeat?: { hits: number; of: number }; // behaviour stats
  firstBuyOffset?: number; // seconds relative to post (negative = before)
  trades: Trade[];
}

export interface Call {
  source: "x" | "farcaster" | "telegram" | "token";
  url?: string;
  handle?: string; // caller handle without @
  displayName?: string;
  text?: string;
  postedAt?: number; // unix seconds, exact to the second
  token: { chain: Chain; address: string; symbol?: string; name?: string };
}

export interface Card {
  id: string; // stable hash of call url or token+handle
  call: Call;
  callerWallets: CrewMember[]; // tier claimed or public
  crew: CrewMember[]; // tier funded or behaviour
  copyBots: CrewMember[]; // repeat buyers who buy AFTER the caller (also dump on followers)
  early?: CrewMember[]; // bought in the minutes right before the post; not tied to the caller unless seen on their other posts
  summary: {
    firstInsiderBuyOffset?: number; // seconds vs post, negative = before
    firstInsiderSellOffset?: number; // seconds vs post
    insidersSold: boolean;
    insiderNetQuote: number; // quote received from sells minus spent on buys
    insiderNetUsd?: number;
    stillHoldingPct: number; // share of insider tokens still held, 0 to 100
  };
  coverage: {
    earlyVolumeAttributedPct: number; // share of buy volume before the post that we attribute to known wallets
    note: string;
  };
  verdict: "clean" | "exited" | "sold_into_followers" | "unknown";
  verdictLine: string; // one factual sentence, never "scam"
  computedAt: number;
}

export interface ArmedExit {
  id: string;
  chain: Chain;
  owner: string; // user wallet
  token: string;
  watch: string[]; // crew and caller wallets whose first sell triggers the exit
  amount: string; // token amount (raw units) to sell
  maxSlippageBps: number;
  status: "pending" | "armed" | "fired" | "cancelled" | "failed";
  armedAt: number;
  armTx?: string;
  trigger?: { wallet: string; tx: string; ts: number };
  exit?: { tx: string; ts: number; quoteOut: number; usdOut?: number };
  selfTest?: boolean; // run with our own wallets as crew and rider
}
