import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { readFileSync } from "fs";
(async () => {
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.USERPROFILE + "/.wingman/sol-tester.json", "utf8"))));
  const r = await fetch("https://wingman.jdollar.site/api/exits/sol", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ride", owner: kp.publicKey.toBase58(), mint: "22JKmY9YZfnQfb3pGYb6hctL5Jyvv3zhL3nQ8oyNuoYp", sol: 0.01, slippageBps: 300, watch: ["HhNj9av4oN7xG3a2vM5aT4x3eH3pLq8cY6pVf2s5Hc7"] }) }).then((x) => x.json());
  const tx = VersionedTransaction.deserialize(Buffer.from(r.tx, "base64"));
  tx.sign([kp]);
  const rpc = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  const sim = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "simulateTransaction", params: [Buffer.from(tx.serialize()).toString("base64"), { encoding: "base64", sigVerify: true }] }) }).then((x) => x.json());
  console.log(JSON.stringify(sim.result?.value?.err ?? sim.error), (sim.result?.value?.logs || []).slice(-6).join("\n"));
})();
