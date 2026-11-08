import kols from "@/data/kols-sol.json";
import type { Chain, CrewMember } from "../types";
import { getClaims } from "../store";

type Kol = { handle: string; name: string; wallets: string[] };
const KOLS = new Map<string, Kol>((kols.kols as Kol[]).map((k) => [k.handle, k]));

export function kolName(handle: string) {
  return KOLS.get(handle.toLowerCase())?.name;
}

async function farcasterByX(handle: string): Promise<{ eth: string[]; sol: string[]; username?: string }> {
  const key = process.env.NEYNAR_API_KEY;
  if (!key) return { eth: [], sol: [] };
  try {
    const r = await fetch(`https://api.neynar.com/v2/farcaster/user/by_x_username?x_username=${encodeURIComponent(handle)}`, {
      headers: { "x-api-key": key },
      cache: "no-store",
    });
    if (!r.ok) return { eth: [], sol: [] };
    const users = (await r.json()).users || [];
    const eth = new Set<string>();
    const sol = new Set<string>();
    let username: string | undefined;
    for (const u of users) {
      username ||= u.username;
      for (const a of u.verified_addresses?.eth_addresses || []) eth.add(a.toLowerCase());
      for (const a of u.verified_addresses?.sol_addresses || []) sol.add(a);
    }
    return { eth: [...eth], sol: [...sol], username };
  } catch {
    return { eth: [], sol: [] };
  }
}

// Every wallet we can tie to this caller on this chain, with how we know.
export async function callerWallets(handle: string | undefined, chain: Chain): Promise<CrewMember[]> {
  if (!handle) return [];
  const h = handle.toLowerCase();
  const out = new Map<string, CrewMember>();
  for (const c of await getClaims(h)) {
    if (c.chain === chain) out.set(c.wallet, { wallet: c.wallet, tier: "claimed", evidence: "Signed by the caller from this wallet", proofUrl: c.proofUrl, trades: [] });
  }
  if (chain === "solana") {
    for (const w of KOLS.get(h)?.wallets || []) {
      if (!out.has(w))
        out.set(w, {
          wallet: w,
          tier: "public",
          evidence: "Listed as this caller's wallet on the Kolscan leaderboard",
          proofUrl: `https://kolscan.io/account/${w}`,
          trades: [],
        });
    }
  }
  const fc = await farcasterByX(h);
  for (const w of chain === "solana" ? fc.sol : fc.eth) {
    if (!out.has(w))
      out.set(w, {
        wallet: w,
        tier: "public",
        evidence: `Verified on Farcaster by @${fc.username}, who links this X account`,
        proofUrl: fc.username ? `https://farcaster.xyz/${fc.username}` : undefined,
        trades: [],
      });
  }
  return [...out.values()];
}
