// End to end self test on Base mainnet with our own wallets: crew buys, rider buys and arms,
// crew sells, keeper fires the rider's exit. Every step is a real transaction.
import { createWalletClient, http, parseAbi, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { writeFileSync } from "fs";
import { buyQuote, recordArm, onBaseActivity, pub, exitAbi } from "../src/lib/exits/base";
import { armMessage } from "../src/lib/exits/message";
import { decodeEventLog } from "viem";
import { getExit } from "../src/lib/store";

const TOKEN = (process.argv[2] || "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed") as Hex; // DEGEN
const EXIT = process.env.NEXT_PUBLIC_EXIT_ADDRESS as Hex;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"]);
const armAbi = parseAbi(["function armWithFloor(address token, uint256 amount, uint16 maxSlippageBps, uint256 minUsdcOut) returns (uint256)"]);
const rpc = http(process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com");
const c = pub();
const wallet = (pk: string) => createWalletClient({ account: privateKeyToAccount(pk as Hex), chain: base, transport: rpc });
const crew = wallet(process.env.CREW_PK!);
const rider = wallet(process.env.RIDER_PK!);
const log: Record<string, unknown> = { token: TOKEN, exit: EXIT, crew: crew.account.address, rider: rider.account.address };
const wait = async (h: Hex, label: string) => {
  const r = await c.waitForTransactionReceipt({ hash: h, timeout: 90_000 });
  console.log(label, h, r.status);
  log[label] = h;
  if (r.status !== "success") throw new Error(`${label} reverted`);
  return r;
};

async function buy(w: ReturnType<typeof wallet>, eth: string, label: string) {
  const q = await buyQuote({ taker: w.account.address, token: TOKEN, ethWei: parseEther(eth).toString(), slippageBps: 300 });
  const h = await w.sendTransaction({ to: q.to, data: q.data, value: BigInt(q.value), gas: q.gas ? BigInt(q.gas) * 2n : undefined });
  await wait(h, label);
}

(async () => {
  await buy(crew, "0.0002", "crewBuy");
  await buy(rider, "0.0008", "riderBuy");
  const bal = await c.readContract({ address: TOKEN, abi: erc20, functionName: "balanceOf", args: [rider.account.address] });
  log.riderTokens = bal.toString();
  // Floor: half of today's USDC value for the whole position, so a bad fill can never go below it.
  const r = await fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${TOKEN}&tokenOut=${USDC}&amountIn=${bal}`, { headers: { "x-client-id": "wingman" } }).then((x) => x.json());
  const floor = BigInt(r.data.routeSummary.amountOut) / 2n;
  await wait(await rider.writeContract({ address: TOKEN, abi: erc20, functionName: "approve", args: [EXIT, bal] }), "riderApprove");
  const armRc = await wait(await rider.writeContract({ address: EXIT, abi: armAbi, functionName: "armWithFloor", args: [TOKEN, bal, 3000, floor] }), "riderArm");
  const armLog = armRc.logs.find((l) => l.address.toLowerCase() === EXIT.toLowerCase())!;
  const armEv = decodeEventLog({ abi: exitAbi, data: armLog.data, topics: armLog.topics });
  const armId = (armEv.args as { id: bigint }).id;
  const signature = await rider.signMessage({ message: armMessage(armId, [crew.account.address]) });
  const e = await recordArm({ txHash: armRc.transactionHash, watch: [crew.account.address], signature });
  console.log("armed", e.id, "watching", e.watch);

  // Crew sells everything back to ETH.
  const crewBal = await c.readContract({ address: TOKEN, abi: erc20, functionName: "balanceOf", args: [crew.account.address] });
  const u = new URL("https://api.0x.org/swap/allowance-holder/quote");
  u.search = new URLSearchParams({ chainId: "8453", sellToken: TOKEN, buyToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", sellAmount: crewBal.toString(), taker: crew.account.address, slippageBps: "300" }).toString();
  const q = await fetch(u, { headers: { "0x-api-key": process.env.ZEROX_API_KEY!, "0x-version": "v2" } }).then((x) => x.json());
  if (q.issues?.allowance) await wait(await crew.writeContract({ address: TOKEN, abi: erc20, functionName: "approve", args: [q.issues.allowance.spender, crewBal] }), "crewApprove");
  const sellRc = await wait(await crew.sendTransaction({ to: q.transaction.to, data: q.transaction.data, value: BigInt(q.transaction.value), gas: BigInt(q.transaction.gas) * 2n }), "crewSell");
  const blk = await c.getBlock({ blockNumber: sellRc.blockNumber });

  const t0 = Date.now();
  const fired = await onBaseActivity({ from: crew.account.address, token: TOKEN, tx: sellRc.transactionHash, ts: Number(blk.timestamp) });
  const after = await getExit(e.id);
  log.fired = fired;
  log.exitRecord = after;
  log.keeperSeconds = (Date.now() - t0) / 1000;
  console.log(JSON.stringify(after, null, 1));
  writeFileSync("../docs/proof/base-selftest.json", JSON.stringify(log, null, 1));
  void exitAbi;
})().catch((err) => {
  console.error(err);
  writeFileSync("../docs/proof/base-selftest-failed.json", JSON.stringify({ ...log, error: String(err) }, null, 1));
  process.exit(1);
});
