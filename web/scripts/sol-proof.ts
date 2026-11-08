// End to end self test on Solana mainnet with our own wallets: crew buys, rider rides (buy + nonce),
// rider signs the exit (held, not sent), crew sells, Wingman submits the held exit.
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import * as flow from "../src/lib/exits/flow";
import { rpcUrl } from "../src/lib/exits/solana";
import { getExit } from "../src/lib/store";

const MINT = process.argv[2] || "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"; // BONK
const WSOL = "So11111111111111111111111111111111111111112";
const home = process.env.HOME || process.env.USERPROFILE!;
const load = (f: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(f, "utf8"))));
const rider = load(`${home}/.wingman/sol-tester.json`);
const crewPath = `${home}/.wingman/sol-crew.json`;
if (!existsSync(crewPath)) writeFileSync(crewPath, JSON.stringify(Array.from(Keypair.generate().secretKey)));
const crew = load(crewPath);
const conn = new Connection(rpcUrl(), "confirmed");
const log: Record<string, unknown> = { mint: MINT, rider: rider.publicKey.toBase58(), crew: crew.publicKey.toBase58() };
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");

async function send(tx: VersionedTransaction, label: string) {
  const sig = await conn.sendTransaction(tx, { maxRetries: 5 });
  const r = await conn.confirmTransaction(sig, "confirmed");
  console.log(label, sig, r.value.err ? "FAILED" : "ok");
  log[label] = sig;
  if (r.value.err) throw new Error(`${label} failed ${JSON.stringify(r.value.err)}`);
  return sig;
}

async function jupSwap(kp: Keypair, input: string, output: string, amount: string, label: string) {
  const q = await fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${input}&outputMint=${output}&amount=${amount}&slippageBps=300`).then((r) => r.json());
  const s = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quoteResponse: q, userPublicKey: kp.publicKey.toBase58(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true }),
  }).then((r) => r.json());
  const tx = VersionedTransaction.deserialize(Buffer.from(s.swapTransaction, "base64"));
  tx.sign([kp]);
  return send(tx, label);
}

async function crewBalanceRaw() {
  const r = await conn.getParsedTokenAccountsByOwner(crew.publicKey, { mint: new (await import("@solana/web3.js")).PublicKey(MINT) });
  return r.value.reduce((a, x) => a + BigInt(x.account.data.parsed.info.tokenAmount.amount), 0n).toString();
}

(async () => {
  // Fund the crew wallet from the rider if it is empty.
  if ((await conn.getBalance(crew.publicKey)) < 15_000_000) {
    const { SystemProgram, TransactionMessage } = await import("@solana/web3.js");
    const { blockhash } = await conn.getLatestBlockhash();
    const msg = new TransactionMessage({ payerKey: rider.publicKey, recentBlockhash: blockhash, instructions: [SystemProgram.transfer({ fromPubkey: rider.publicKey, toPubkey: crew.publicKey, lamports: 20_000_000 })] }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([rider]);
    await send(tx, "fundCrew");
  }
  await jupSwap(crew, WSOL, MINT, "5000000", "crewBuy");

  // Rider: one signature to buy and create the nonce.
  const r = await flow.ride({ owner: rider.publicKey.toBase58(), mint: MINT, sol: 0.02, slippageBps: 300, watch: [crew.publicKey.toBase58()] });
  const rideTx = VersionedTransaction.deserialize(Buffer.from(r.tx, "base64"));
  rideTx.sign([rider]);
  const rideSig = await send(rideTx, "riderRide");

  // Second signature: the exit, held by Wingman, not sent.
  const p = await flow.prepareExit({ id: r.id, sig: rideSig });
  const exitTx = VersionedTransaction.deserialize(Buffer.from(p.tx, "base64"));
  exitTx.sign([rider]);
  const armed = await flow.confirmArm({ id: r.id, signedTx: b64(exitTx.serialize()) }).catch(async (e) => {
    // The webhook sync needs the public URL; the arm itself is stored before that step.
    console.log("note:", e.message);
    return getExit(r.id);
  });
  console.log("armed", armed?.id, armed?.status);

  // Crew sells everything.
  const sellSig = await jupSwap(crew, MINT, WSOL, await crewBalanceRaw(), "crewSell");
  const parsed = await fetch(`https://api.helius.xyz/v0/transactions?api-key=${process.env.HELIUS_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transactions: [sellSig] }),
  }).then((x) => x.json());
  const t0 = Date.now();
  const fired = await flow.onActivity(parsed[0]);
  const e = await getExit(r.id);
  log.fired = fired;
  log.exitRecord = e;
  log.keeperSeconds = (Date.now() - t0) / 1000;
  console.log(JSON.stringify(e, null, 1));
  writeFileSync("../docs/proof/solana-selftest.json", JSON.stringify(log, null, 1));
})().catch((err) => {
  console.error(err);
  writeFileSync("../docs/proof/solana-selftest-failed.json", JSON.stringify({ ...log, error: String(err) }, null, 1));
  process.exit(1);
});
