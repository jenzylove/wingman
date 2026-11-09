// Base armed exits through the WingmanExit contract. The keeper can only call fire(),
// which sells the armed amount and pays the owner. Proceeds can't go anywhere else.
import { createPublicClient, createWalletClient, decodeEventLog, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import type { ArmedExit } from "../types";
import { claimOnce, getExit, saveExit, watchAdd, watchGet } from "../store";
import { armMessage } from "./message";
import { tradeInTx } from "../engine/base";

export const EXIT = () => process.env.NEXT_PUBLIC_EXIT_ADDRESS as Hex | undefined;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const KYBER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5";
export const exitAbi = parseAbi([
  "event Armed(uint256 indexed id, address indexed owner, address indexed token, uint256 amount, uint16 maxSlippageBps, uint256 minUsdcOut)",
  "event Fired(uint256 indexed id, address indexed owner, address indexed token, uint256 sold, uint256 usdcOut, uint256 fee, address triggerWallet, bytes32 triggerTx)",
  "function fire(uint256 id, address router, bytes data, uint256 quotedOut, bytes32 triggerTx, address triggerWallet) returns (uint256)",
  "function arms(uint256) view returns (address owner, address token, uint256 amount, uint256 minUsdcOut, uint16 maxSlippageBps, bool active, uint64 armedAt)",
]);
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"]);

export const pub = () => createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com") });

export class BaseFlowError extends Error {}

// 0x quote to buy a token with ETH, for the user's own wallet to send.
export async function buyQuote(p: { taker: string; token: string; ethWei: string; slippageBps: number }) {
  const u = new URL("https://api.0x.org/swap/allowance-holder/quote");
  u.search = new URLSearchParams({
    chainId: "8453",
    sellToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    buyToken: p.token,
    sellAmount: p.ethWei,
    taker: p.taker,
    slippageBps: String(p.slippageBps),
  }).toString();
  const r = await fetch(u, { headers: { "0x-api-key": process.env.ZEROX_API_KEY || "", "0x-version": "v2" }, cache: "no-store" });
  const j = await r.json();
  if (!j.transaction) throw new BaseFlowError(j.message || j.reason || "No route to buy this token on Base right now.");
  return { to: j.transaction.to, data: j.transaction.data, value: j.transaction.value, gas: j.transaction.gas, buyAmount: j.buyAmount, minBuyAmount: j.minBuyAmount };
}

// The user armed onchain. We read the Armed event from their tx and start watching.
export async function recordArm(p: { txHash: Hex; watch: string[]; signature?: Hex; cardId?: string }) {
  const exit = EXIT();
  if (!exit) throw new BaseFlowError("Base exits aren't deployed yet.");
  if (!/^0x[a-fA-F0-9]{64}$/.test(p.txHash)) throw new BaseFlowError("Bad transaction hash.");
  const rc = await pub().waitForTransactionReceipt({ hash: p.txHash, timeout: 60_000 });
  const log = rc.logs.find((l) => l.address.toLowerCase() === exit.toLowerCase());
  if (!log) throw new BaseFlowError("That transaction didn't arm an exit.");
  const ev = decodeEventLog({ abi: exitAbi, data: log.data, topics: log.topics });
  if (ev.eventName !== "Armed") throw new BaseFlowError("That transaction didn't arm an exit.");
  const a = ev.args;
  const watch = [...new Set(p.watch.filter((w) => /^0x[a-fA-F0-9]{40}$/.test(w)).map((w) => w.toLowerCase()))].slice(0, 50);
  if (!watch.length) throw new BaseFlowError("There are no wallets to watch for this call.");
  if (await getExit(`base-${a.id.toString()}`)) throw new BaseFlowError("This exit is already recorded.");
  // Only the arm owner decides which wallets trigger their exit.
  const ok = p.signature
    ? await pub().verifyMessage({ address: a.owner, message: armMessage(a.id, watch), signature: p.signature }).catch(() => false)
    : false;
  if (!ok) throw new BaseFlowError("The watch list must be signed by the wallet that armed the exit.");
  const e: ArmedExit = {
    id: `base-${a.id.toString()}`,
    chain: "base",
    owner: a.owner.toLowerCase(),
    token: a.token.toLowerCase(),
    watch,
    amount: a.amount.toString(),
    maxSlippageBps: a.maxSlippageBps,
    status: "armed",
    armedAt: Math.floor(Date.now() / 1000),
    armTx: p.txHash,
  };
  await saveExit(e);
  for (const w of watch) await watchAdd(w, e.id);
  return e;
}

async function kyberRoute(token: string, amount: bigint, sender: string) {
  const r = await fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${token}&tokenOut=${USDC}&amountIn=${amount}`, {
    headers: { "x-client-id": "wingman" },
    cache: "no-store",
  }).then((x) => x.json());
  const summary = r.data?.routeSummary;
  if (!summary) throw new Error("no kyber route");
  const b = await fetch("https://aggregator-api.kyberswap.com/base/api/v1/route/build", {
    method: "POST",
    headers: { "content-type": "application/json", "x-client-id": "wingman" },
    body: JSON.stringify({ routeSummary: summary, sender, recipient: sender, slippageTolerance: 3000 }),
    cache: "no-store",
  }).then((x) => x.json());
  if (!b.data?.data) throw new Error("kyber build failed");
  return { router: (b.data.routerAddress || KYBER) as Hex, data: b.data.data as Hex, quotedOut: BigInt(summary.amountOut) };
}

// A watched Base wallet moved an armed token out. Fire the matching exits.
// A real sale moves WETH or USDC in the same transaction. A plain transfer to another wallet doesn't.
// The watched wallet itself must sell this token and receive ETH, WETH or USDC for it, in this transaction.
async function isSale(tx: string, token: string, wallet: string) {
  const t = await tradeInTx(tx, token, wallet);
  return Boolean(t && t.side === "sell" && (t.eth > 0 || t.usdc > 0));
}

export async function onBaseActivity(p: { from: string; token: string; tx: string; ts: number }) {
  const exit = EXIT();
  const key = process.env.KEEPER_PRIVATE_KEY as Hex | undefined;
  if (!exit || !key) return [];
  if (!(await isSale(p.tx, p.token, p.from))) return [];
  const fired: string[] = [];
  for (const id of await watchGet(p.from.toLowerCase())) {
    const e = await getExit(id);
    if (!e || e.chain !== "base" || e.status !== "armed" || e.token !== p.token.toLowerCase()) continue;
    if (!(await claimOnce(`firing:${id}`, 120))) continue;
    e.trigger = { wallet: p.from.toLowerCase(), tx: p.tx, ts: p.ts };
    let sent = false;
    try {
      const c = pub();
      const [bal, allow] = await Promise.all([
        c.readContract({ address: e.token as Hex, abi: erc20, functionName: "balanceOf", args: [e.owner as Hex] }),
        c.readContract({ address: e.token as Hex, abi: erc20, functionName: "allowance", args: [e.owner as Hex, exit] }),
      ]);
      let amt = BigInt(e.amount);
      if (bal < amt) amt = bal;
      if (allow < amt) amt = allow;
      const route = await kyberRoute(e.token, amt, exit);
      const wallet = createWalletClient({ account: privateKeyToAccount(key), chain: base, transport: http(process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com") });
      const hash = await wallet.writeContract({
        address: exit,
        abi: exitAbi,
        functionName: "fire",
        args: [BigInt(e.id.replace("base-", "")), route.router, route.data, route.quotedOut, (p.tx.length === 66 ? p.tx : `0x${"0".repeat(64)}`) as Hex, p.from as Hex],
      });
      sent = true;
      const rc = await c.waitForTransactionReceipt({ hash, timeout: 60_000 });
      let usdc = 0;
      for (const l of rc.logs) {
        try {
          const ev = decodeEventLog({ abi: exitAbi, data: l.data, topics: l.topics });
          if (ev.eventName === "Fired") usdc = Number(ev.args.usdcOut - ev.args.fee) / 1e6;
        } catch {}
      }
      e.status = rc.status === "success" ? "fired" : "failed";
      e.exit = { tx: hash, ts: Math.floor(Date.now() / 1000), quoteOut: usdc, usdOut: usdc };
    } catch (err) {
      console.error("base fire failed", id, err);
      // Nothing reached the chain: the arm is still active onchain, so keep watching and retry on the next sell.
      e.status = sent ? "failed" : "armed";
      if (!sent) e.trigger = undefined;
    }
    await saveExit(e);
    fired.push(id);
  }
  return fired;
}
