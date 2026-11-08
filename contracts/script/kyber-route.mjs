// Fetches a KyberSwap route on Base and prints abi.encode(address router, bytes data, uint256 amountOut)
// as 0x hex on stdout, for forge ffi. Usage:
//   node script/kyber-route.mjs <tokenIn> <tokenOut> <amountIn> <senderAndRecipient> [slippageBps]
const [tokenIn, tokenOut, amountIn, who, slip = "300"] = process.argv.slice(2);
const base = "https://aggregator-api.kyberswap.com/base/api/v1";
const headers = { "x-client-id": "wingman", "content-type": "application/json" };

const q = new URLSearchParams({ tokenIn, tokenOut, amountIn });
const r1 = await fetch(`${base}/routes?${q}`, { headers }).then((r) => r.json());
if (r1.code !== 0) throw new Error("routes: " + JSON.stringify(r1));

const r2 = await fetch(`${base}/route/build`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    routeSummary: r1.data.routeSummary,
    sender: who,
    recipient: who,
    slippageTolerance: Number(slip),
  }),
}).then((r) => r.json());
if (r2.code !== 0) throw new Error("build: " + JSON.stringify(r2));

const { routerAddress, data, amountOut } = r2.data;
const word = (hex) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
const body = data.replace(/^0x/, "");
const len = body.length / 2;
const padded = body.padEnd(Math.ceil(body.length / 64) * 64, "0");
const out =
  "0x" +
  word(routerAddress) +
  word((96).toString(16)) +
  word(BigInt(amountOut).toString(16)) +
  word(len.toString(16)) +
  padded;
process.stdout.write(out);
