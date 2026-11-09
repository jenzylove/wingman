import type { Chain, Tier } from "@/lib/types";

export function txUrl(chain: Chain, tx: string): string {
  return chain === "solana" ? `https://solscan.io/tx/${tx}` : `https://basescan.org/tx/${tx}`;
}

export function addressUrl(chain: Chain, addr: string): string {
  return chain === "solana" ? `https://solscan.io/account/${addr}` : `https://basescan.org/address/${addr}`;
}

export function tokenUrl(chain: Chain, addr: string): string {
  return chain === "solana" ? `https://solscan.io/token/${addr}` : `https://basescan.org/token/${addr}`;
}

export function short(addr: string, head = 4, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Duration in plain words, e.g. 38s, 2m 14s, 1h 5m. */
export function dur(seconds: number): string {
  const s = Math.round(Math.abs(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** Offset relative to the post in plain words. */
export function offsetWords(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "Not seen";
  if (Math.round(seconds) === 0) return "Same second as the post";
  return seconds < 0 ? `${dur(seconds)} before the post` : `${dur(seconds)} after the post`;
}

/** Compact axis label: T-40s, POST, T+3m */
export function tLabel(seconds: number): string {
  if (seconds === 0) return "POST";
  return `T${seconds < 0 ? "-" : "+"}${dur(seconds).replace(" ", "")}`;
}

/** Accepts unix seconds or milliseconds. */
export function toMs(ts: number): number {
  return ts > 1e12 ? ts : ts * 1000;
}

export function clock(ts: number): string {
  const d = new Date(toMs(ts));
  return d.toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" });
}

export function clockUtc(ts: number): string {
  return `${clock(ts)} UTC`;
}

export function dateTimeUtc(ts: number): string {
  const d = new Date(toMs(ts));
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}, ${clock(ts)} UTC`;
}

export function ago(ts: number, now = Date.now()): string {
  const s = (now - toMs(ts)) / 1000;
  if (s < 0) return "just now";
  if (s < 45) return "just now";
  return `${dur(s)} ago`;
}

export function num(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function signed(n: number, digits = 2): string {
  return `${n > 0 ? "+" : ""}${num(n, digits)}`;
}

export const TIER_INFO: Record<Tier, { label: string; help: string }> = {
  claimed: { label: "Claimed", help: "The caller signed a message from this wallet." },
  public: { label: "Public", help: "Publicly linked to the caller: the Kolscan KOL list or a verified Farcaster address." },
  funded: { label: "Funded", help: "Funded directly by a known caller wallet." },
  behaviour: { label: "Repeat", help: "Seen buying with this caller again and again: within 20s of their buys on several recent tokens, or right before several of their posts we have checked. Behaviour, not proven ownership." },
  early: { label: "Early", help: "Bought in the 3 minutes before this post. Not tied to the caller yet: early on 2 or more of their posts and it becomes crew." },
};

export function chainName(chain: Chain): string {
  return chain === "solana" ? "Solana" : "Base";
}

export function quoteSymbol(chain: Chain): "SOL" | "ETH" {
  return chain === "solana" ? "SOL" : "ETH";
}
