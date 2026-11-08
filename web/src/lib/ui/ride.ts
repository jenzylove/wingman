import type { ArmedExit, Chain } from "@/lib/types";

export interface RideRequest {
  chain: Chain;
  owner: string;
  token: string;
  watch: string[];
  /** Amount of SOL or ETH the user wants to spend on the buy, as typed. */
  spend: string;
  maxSlippageBps: number;
  cardId?: string;
}

/**
 * Ride = buy the token, then arm an exit on what was bought.
 *
 * WIRING POINT: wallet signing lives here. Today this only posts the intent to
 * POST /api/exits. The engine side should: build the buy, ask the wallet to sign
 * it (wagmi on Base, window.solana.signTransaction on Solana), grant the sell only
 * permission, then record the armed exit with the raw token amount bought.
 */
export async function ride(req: RideRequest): Promise<ArmedExit> {
  const res = await fetch("/api/exits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok || !body || (typeof body === "object" && "error" in body)) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : res.status === 404
          ? "Arming exits is not live on this server yet."
          : `Could not arm the exit (status ${res.status}).`;
    throw new Error(msg);
  }
  const b = body as ArmedExit | { exit: ArmedExit };
  return "id" in b ? b : b.exit;
}
