import { VersionedTransaction } from "@solana/web3.js";
import type { ArmedExit } from "@/lib/types";

/** The wallet functions the Solana ride flow needs (from useSolanaWallet). */
export interface SolSigner {
  signAndSendTransaction(tx: VersionedTransaction): Promise<string>;
  signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>;
}

export type RideStep = "buy" | "locking" | "sign_exit" | "saving";

async function solApi<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/exits/sol", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the Wingman API.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (data && typeof data === "object" && "error" in data) throw new Error(String((data as { error: unknown }).error));
  if (!res.ok || !data) throw new Error(res.status === 404 ? "Arming exits is not live on this server yet." : `The Wingman API answered with status ${res.status}.`);
  return data as T;
}

function fromB64(b64: string): VersionedTransaction {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return VersionedTransaction.deserialize(bytes);
}

function toB64(tx: VersionedTransaction): string {
  const bytes = tx.serialize();
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export interface SolRideInput {
  mode: "ride" | "hold";
  owner: string;
  mint: string;
  sol?: number;
  slippageBps?: number;
  watch: string[];
  cardId?: string;
}

/**
 * Solana: buy (or set up on a token already held), then sign the exit, which is held
 * by Wingman and sent only when a watched wallet sells.
 * `beforeExitSign` lets the UI show the plain words explanation before the wallet pops up.
 */
export async function rideSolana(
  input: SolRideInput,
  signer: SolSigner,
  onStep: (s: RideStep) => void,
  beforeExitSign: () => Promise<void>,
): Promise<ArmedExit> {
  onStep("buy");
  const start =
    input.mode === "ride"
      ? await solApi<{ id: string; tx: string; quotedTokens?: number | string }>({
          action: "ride",
          owner: input.owner,
          mint: input.mint,
          sol: input.sol,
          slippageBps: input.slippageBps,
          watch: input.watch,
          cardId: input.cardId,
        })
      : await solApi<{ id: string; tx: string }>({ action: "hold", owner: input.owner, mint: input.mint, watch: input.watch, cardId: input.cardId });

  const sig = await signer.signAndSendTransaction(fromB64(start.tx));

  onStep("locking");
  const prep = await solApi<{ tx: string; quotedOutLamports?: number | string; minOutLamports?: number | string }>({ action: "prepare", id: start.id, sig });

  onStep("sign_exit");
  await beforeExitSign();
  const signed = await signer.signTransaction(fromB64(prep.tx));

  onStep("saving");
  const done = await solApi<{ exit: ArmedExit }>({ action: "confirm", id: start.id, signedTx: toB64(signed) });
  return done.exit;
}

/** Cancel an armed Solana exit: sign and send the cancel, then record it. */
export async function cancelSolana(id: string, owner: string, signer: SolSigner): Promise<ArmedExit> {
  const r = await solApi<{ tx: string }>({ action: "cancel", id, owner });
  const sig = await signer.signAndSendTransaction(fromB64(r.tx));
  const done = await solApi<{ exit: ArmedExit }>({ action: "cancelled", id, sig });
  return done.exit;
}

// ---------------------------------------------------------------- Base

import { getAccount, readContract, sendTransaction, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { parseAbi, parseEther, type Hex } from "viem";
import { wagmiConfig } from "@/lib/wallet/wagmi";

const baseErc20 = parseAbi(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"]);
const armAbi = parseAbi(["function armWithFloor(address token, uint256 amount, uint16 maxSlippageBps, uint256 minUsdcOut) returns (uint256)"]);

async function baseApi<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/exits/base", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) throw new Error("Could not reach the Wingman API.");
  const data = await res.json().catch(() => null);
  if (data?.error) throw new Error(String(data.error));
  if (!res.ok || !data) throw new Error(`The Wingman API answered with status ${res.status}.`);
  return data as T;
}

export interface BaseRideInput {
  mode: "ride" | "hold";
  token: string;
  eth?: number;
  slippageBps?: number;
  watch: string[];
  cardId?: string;
}

/**
 * Base: buy with ETH (optional), approve exactly the position to WingmanExit, then arm it with
 * a USDC floor. The contract can only sell that amount and only pays the owner.
 */
export async function rideBase(input: BaseRideInput, onStep: (s: RideStep) => void, beforeExitSign: () => Promise<void>): Promise<ArmedExit> {
  const exit = process.env.NEXT_PUBLIC_EXIT_ADDRESS as Hex | undefined;
  if (!exit) throw new Error("Base exits aren't deployed on this server.");
  const owner = getAccount(wagmiConfig).address;
  if (!owner) throw new Error("Connect a Base wallet first.");
  const token = input.token as Hex;
  onStep("buy");
  if (input.mode === "ride") {
    const q = await baseApi<{ to: Hex; data: Hex; value: string; gas?: string }>({
      action: "quote",
      owner,
      token,
      ethWei: parseEther(String(input.eth)).toString(),
      slippageBps: input.slippageBps,
    });
    const h = await sendTransaction(wagmiConfig, { to: q.to, data: q.data, value: BigInt(q.value), gas: q.gas ? BigInt(q.gas) * 2n : undefined });
    const rc = await waitForTransactionReceipt(wagmiConfig, { hash: h });
    if (rc.status !== "success") throw new Error("The buy didn't go through. Nothing was armed.");
  }
  const amount = await readContract(wagmiConfig, { address: token, abi: baseErc20, functionName: "balanceOf", args: [owner] });
  if (amount === 0n) throw new Error("No tokens in the wallet to protect yet.");
  onStep("locking");
  const { floor } = await baseApi<{ floor: string }>({ action: "floor", token, amount: amount.toString() });
  const ah = await writeContract(wagmiConfig, { address: token, abi: baseErc20, functionName: "approve", args: [exit, amount] });
  await waitForTransactionReceipt(wagmiConfig, { hash: ah });
  onStep("sign_exit");
  await beforeExitSign();
  const armHash = await writeContract(wagmiConfig, {
    address: exit,
    abi: armAbi,
    functionName: "armWithFloor",
    args: [token, amount, input.slippageBps ?? 1500, BigInt(floor)],
  });
  await waitForTransactionReceipt(wagmiConfig, { hash: armHash });
  onStep("saving");
  const done = await baseApi<{ exit: ArmedExit }>({ action: "record", txHash: armHash, watch: input.watch, cardId: input.cardId });
  return done.exit;
}
