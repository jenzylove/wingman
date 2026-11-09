import type { Card, CrewMember, Trade } from "@/lib/types";

/**
 * What the insiders are doing right now, in one word. This drives the card headline
 * and which actions we offer: nobody should be offered a buy after the crew left.
 */
export type Stance = "in" | "selling" | "out" | "none";

export interface StanceResult {
  stance: Stance;
  /** Wallets we treat as insiders for this card (known crew, or early buyers when no known wallet traded). */
  insiders: CrewMember[];
  /** True when the insiders are the early buyers because no known wallet traded. */
  earlyOnly: boolean;
  /** Insiders still holding more than 5% of what they bought. */
  holding: CrewMember[];
}

const HOLD_SHARE = 0.05;

function sum(trades: Trade[], side: Trade["side"]) {
  return trades.filter((t) => t.side === side).reduce((s, t) => s + (Number.isFinite(t.tokenAmount) ? t.tokenAmount : 0), 0);
}

/** A wallet holds if what it bought minus what it sold is more than 5% of what it bought. */
export function isHolding(m: CrewMember): boolean {
  const bought = sum(m.trades, "buy");
  if (bought <= 0) return false;
  const sold = sum(m.trades, "sell");
  return bought - sold > bought * HOLD_SHARE;
}

export function insidersOf(card: Card): { insiders: CrewMember[]; earlyOnly: boolean } {
  const known = [...card.callerWallets, ...card.crew].filter((m) => m.trades.length > 0);
  if (known.length) return { insiders: known, earlyOnly: false };
  const early = (card.early ?? []).filter((m) => m.trades.length > 0);
  return { insiders: early, earlyOnly: early.length > 0 };
}

export function stanceOf(card: Card): StanceResult {
  const { insiders, earlyOnly } = insidersOf(card);
  const holding = insiders.filter(isHolding);
  if (insiders.length === 0) return { stance: "none", insiders, earlyOnly, holding };
  const anySold = insiders.some((m) => m.trades.some((t) => t.side === "sell"));
  if (!anySold) return { stance: "in", insiders, earlyOnly, holding };
  // A little trimming isn't leaving: while they still hold 75% or more of what they bought, the crew is in.
  const sum = (side: "buy" | "sell") => insiders.flatMap((m) => m.trades).filter((t) => t.side === side).reduce((a, t) => a + t.tokenAmount, 0);
  const bought = sum("buy");
  if (bought > 0 && sum("sell") <= bought * 0.25) return { stance: "in", insiders, earlyOnly, holding };
  if (holding.length === 0 || card.summary.stillHoldingPct <= 20) return { stance: "out", insiders, earlyOnly, holding };
  return { stance: "selling", insiders, earlyOnly, holding };
}

export const STANCE_HEADLINE: Record<Stance, string> = {
  in: "Crew still in",
  selling: "Crew is selling",
  out: "Crew is out. Don't chase.",
  none: "No crew found",
};

/** The text a recheck sends to /api/card: the post link, or the token with the caller's handle. */
export function recheckInput(card: Card): string {
  if (card.call.url) return card.call.url;
  return `${card.call.token.address}${card.call.handle ? ` @${card.call.handle}` : ""}`;
}

/** Outbound swap link for selling the token for the chain's native coin. */
export function sellNowUrl(card: Card): string {
  const t = card.call.token;
  return t.chain === "solana"
    ? `https://jup.ag/swap/${t.address}-SOL`
    : `https://app.uniswap.org/swap?chain=base&inputCurrency=${t.address}&outputCurrency=ETH`;
}
