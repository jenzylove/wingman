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

// Before the wallet pops up: only known programs, and the user is the only outside signer.
const SOL_PROGRAMS = new Set([
  "11111111111111111111111111111111",
  "ComputeBudget111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  "SysvarRecentB1ockHashes11111111111111111111",
]);
function checkSolTx(tx: VersionedTransaction, owner: string) {
  const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
  if (keys[0] !== owner) throw new Error("This transaction isn't paid by your wallet. Not signing it.");
  for (const ix of tx.message.compiledInstructions) {
    const pid = keys[ix.programIdIndex];
    if (!SOL_PROGRAMS.has(pid)) throw new Error(`This transaction calls an unexpected program (${pid.slice(0, 6)}). Not signing it.`);
  }
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
      ? await solApi<{ id: string; key: string; tx: string; quotedTokens?: number | string }>({
          action: "ride",
          owner: input.owner,
          mint: input.mint,
          sol: input.sol,
          slippageBps: input.slippageBps,
          watch: input.watch,
          cardId: input.cardId,
        })
      : await solApi<{ id: string; key: string; tx: string }>({ action: "hold", owner: input.owner, mint: input.mint, watch: input.watch, cardId: input.cardId });
  checkSolTx(fromB64(start.tx), input.owner);

  const sig = await signer.signAndSendTransaction(fromB64(start.tx));

  onStep("locking");
  const prep = await solApi<{ tx: string; quotedOutLamports?: number | string; minOutLamports?: number | string }>({ action: "prepare", id: start.id, key: start.key, sig });
  checkSolTx(fromB64(prep.tx), input.owner);

  onStep("sign_exit");
  await beforeExitSign();
  const signed = await signer.signTransaction(fromB64(prep.tx));

  onStep("saving");
  const done = await solApi<{ exit: ArmedExit }>({ action: "confirm", id: start.id, key: start.key, signedTx: toB64(signed) });
  return done.exit;
}

/** Cancel an armed Solana exit: sign and send the cancel, then record it. */
export async function cancelSolana(id: string, owner: string, signer: SolSigner): Promise<ArmedExit> {
  const r = await solApi<{ tx: string }>({ action: "cancel", id, owner });
  const sig = await signer.signAndSendTransaction(fromB64(r.tx));
  void sig;
  const done = await solApi<{ exit: ArmedExit }>({ action: "cancelled", id });
  return done.exit;
}

// ---------------------------------------------------------------- Base

import { getAccount, readContract, sendTransaction, signMessage, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { decodeEventLog, parseAbi, parseEther, type Hex } from "viem";
import { armMessage } from "@/lib/exits/message";
import { wagmiConfig } from "@/lib/wallet/wagmi";

const baseErc20 = parseAbi(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"]);
const armedEvent = parseAbi(["event Armed(uint256 indexed id, address indexed owner, address indexed token, uint256 amount, uint16 maxSlippageBps, uint256 minUsdcOut)"]);
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
    // 0x AllowanceHolder on Base: the only contract we let the buy go to.
    if (q.to.toLowerCase() !== "0x0000000000001ff3684f28c67538d4d072c22734") throw new Error("Unexpected swap contract. Not sending it.");
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
  const armRc = await waitForTransactionReceipt(wagmiConfig, { hash: armHash });
  let armId: bigint | undefined;
  for (const l of armRc.logs) {
    if (l.address.toLowerCase() !== exit.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: armedEvent, data: l.data, topics: l.topics });
      if (ev.eventName === "Armed") armId = ev.args.id;
    } catch {}
  }
  if (armId === undefined) throw new Error("The arm transaction didn't create an exit.");
  onStep("saving");
  // A free signature (no gas): only you choose which wallets trigger your exit.
  const signature = await signMessage(wagmiConfig, { message: armMessage(armId, input.watch) });
  const done = await baseApi<{ exit: ArmedExit }>({ action: "record", txHash: armHash, watch: input.watch, signature, cardId: input.cardId });
  return done.exit;
}
