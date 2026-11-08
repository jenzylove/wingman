// Solana armed exits: a sell signed once by the user on a durable nonce, submitted by us
// the moment a watched wallet sells. We can only submit that exact transaction.
import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createPublicKey, verify } from "crypto";

const WSOL = "So11111111111111111111111111111111111111112";
export const rpcUrl = () => `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const conn = () => new Connection(rpcUrl(), "confirmed");
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");

// Ride: buy the token and create the nonce account in one transaction the user signs and sends.
export async function buildRide(p: { owner: string; mint: string; lamports: string; slippageBps: number }) {
  const c = conn();
  const ownerPk = new PublicKey(p.owner);
  const nonce = Keypair.generate();
  const rent = await c.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  const q = await fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${WSOL}&outputMint=${p.mint}&amount=${p.lamports}&slippageBps=${p.slippageBps}`, { cache: "no-store" }).then((r) => r.json());
  if (!q.outAmount) throw new Error("No route to buy this token right now.");
  const si = await jupInstructions(q, p.owner, 200000, "high");
  const alts: AddressLookupTableAccount[] = [];
  for (const a of si.addressLookupTableAddresses || []) {
    const t = await c.getAddressLookupTable(new PublicKey(a));
    if (t.value) alts.push(t.value);
  }
  const ixs = [
    ...(si.computeBudgetInstructions || []).map(toIx),
    SystemProgram.createAccount({ fromPubkey: ownerPk, newAccountPubkey: nonce.publicKey, lamports: rent, space: NONCE_ACCOUNT_LENGTH, programId: SystemProgram.programId }),
    SystemProgram.nonceInitialize({ noncePubkey: nonce.publicKey, authorizedPubkey: ownerPk }),
    ...(si.setupInstructions || []).map(toIx),
    toIx(si.swapInstruction),
    ...(si.cleanupInstruction ? [toIx(si.cleanupInstruction)] : []),
  ];
  const { blockhash } = await c.getLatestBlockhash();
  const vtx = new VersionedTransaction(new TransactionMessage({ payerKey: ownerPk, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message(alts));
  vtx.sign([nonce]);
  return { tx: b64(vtx.serialize()), nonce: nonce.publicKey.toBase58(), quotedTokens: q.outAmount as string };
}

export async function confirmed(sig: string) {
  const c = conn();
  for (let i = 0; i < 30; i++) {
    const s = (await c.getSignatureStatuses([sig])).value[0];
    if (s?.err) return false;
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// Step 1 (arming a token you already hold): a nonce account owned by the user. Returns a tx for the user to sign and send.
export async function prepareNonce(owner: string) {
  const c = conn();
  const ownerPk = new PublicKey(owner);
  const nonce = Keypair.generate();
  const lamports = await c.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: ownerPk, newAccountPubkey: nonce.publicKey, lamports, space: NONCE_ACCOUNT_LENGTH, programId: SystemProgram.programId }),
    SystemProgram.nonceInitialize({ noncePubkey: nonce.publicKey, authorizedPubkey: ownerPk }),
  );
  tx.feePayer = ownerPk;
  tx.recentBlockhash = (await c.getLatestBlockhash()).blockhash;
  tx.partialSign(nonce);
  return { tx: b64(tx.serialize({ requireAllSignatures: false })), nonce: nonce.publicKey.toBase58(), rentLamports: lamports };
}

type JupIx = { programId: string; accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]; data: string };
const toIx = (i: JupIx) =>
  new TransactionInstruction({
    programId: new PublicKey(i.programId),
    keys: i.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(i.data, "base64"),
  });

async function jupInstructions(quoteResponse: unknown, owner: string, maxLamports: number, level: string) {
  for (let i = 0; i < 4; i++) {
    const si = await fetch("https://lite-api.jup.ag/swap/v1/swap-instructions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quoteResponse, userPublicKey: owner, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports, priorityLevel: level } } }),
      cache: "no-store",
    })
      .then((r) => r.json())
      .catch(() => ({}));
    if (si.swapInstruction) return si;
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  throw new Error("The swap route couldn't be built right now. Try again in a moment.");
}

export async function tokenBalanceRaw(owner: string, mint: string): Promise<{ raw: string; decimals: number }> {
  const r = await conn().getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(mint) });
  let raw = 0n;
  let decimals = 0;
  for (const a of r.value) {
    const t = a.account.data.parsed.info.tokenAmount;
    raw += BigInt(t.amount);
    decimals = t.decimals;
  }
  return { raw: raw.toString(), decimals };
}

// Step 2: the exit itself, a token to SOL sell bound to the nonce. Returns it unsigned for the user to sign (not send).
export async function buildExit(p: { owner: string; mint: string; amountRaw: string; slippageBps: number; nonce: string }) {
  const c = conn();
  const ownerPk = new PublicKey(p.owner);
  const acc = await c.getAccountInfo(new PublicKey(p.nonce));
  if (!acc) throw new Error("Nonce account not found yet. Wait for the first transaction to confirm.");
  const nonceValue = NonceAccount.fromAccountData(acc.data).nonce;
  const q = await fetch(
    `https://lite-api.jup.ag/swap/v1/quote?inputMint=${p.mint}&outputMint=${WSOL}&amount=${p.amountRaw}&slippageBps=${p.slippageBps}`,
    { cache: "no-store" },
  ).then((r) => r.json());
  if (!q.outAmount) throw new Error("No route to sell this token right now.");
  const si = await jupInstructions(q, p.owner, 400000, "veryHigh");

  const alts: AddressLookupTableAccount[] = [];
  for (const a of si.addressLookupTableAddresses || []) {
    const t = await c.getAddressLookupTable(new PublicKey(a));
    if (t.value) alts.push(t.value);
  }
  const ixs = [
    SystemProgram.nonceAdvance({ noncePubkey: new PublicKey(p.nonce), authorizedPubkey: ownerPk }),
    ...(si.computeBudgetInstructions || []).map(toIx),
    ...(si.setupInstructions || []).map(toIx),
    toIx(si.swapInstruction),
    ...(si.cleanupInstruction ? [toIx(si.cleanupInstruction)] : []),
  ];
  const msg = new TransactionMessage({ payerKey: ownerPk, recentBlockhash: nonceValue, instructions: ixs }).compileToV0Message(alts);
  return { tx: b64(new VersionedTransaction(msg).serialize()), quotedOutLamports: q.outAmount as string, minOutLamports: q.otherAmountThreshold as string };
}

// Checks a user-signed exit is exactly the one we built: same message, valid owner signature.
export function verifySigned(unsignedB64: string, signedB64: string, owner: string) {
  const u = VersionedTransaction.deserialize(Buffer.from(unsignedB64, "base64"));
  const s = VersionedTransaction.deserialize(Buffer.from(signedB64, "base64"));
  if (b64(u.message.serialize()) !== b64(s.message.serialize())) throw new Error("Signed transaction differs from the exit we built.");
  const idx = s.message.staticAccountKeys.findIndex((k) => k.toBase58() === owner);
  if (idx !== 0) throw new Error("Missing owner signature.");
  // A real ed25519 check, not just "some bytes are present".
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), new PublicKey(owner).toBuffer()]);
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  if (!verify(null, Buffer.from(s.message.serialize()), key, Buffer.from(s.signatures[0]))) throw new Error("The exit signature isn't valid for this wallet.");
}

// True once the nonce account is gone, which means the held exit can never land.
export async function nonceClosed(nonce: string) {
  return (await conn().getAccountInfo(new PublicKey(nonce))) === null;
}

export async function submit(signedB64: string) {
  const c = conn();
  const sig = await c.sendRawTransaction(Buffer.from(signedB64, "base64"), { skipPreflight: true, maxRetries: 5 });
  const res = await c.confirmTransaction(sig, "confirmed").catch(() => null);
  return { sig, ok: Boolean(res && !res.value.err), err: res?.value.err };
}

// SOL that landed in the owner's wallet from a fired exit.
export async function solReceived(sig: string, owner: string) {
  const t = await conn().getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  if (!t?.meta) return undefined;
  const keys = t.transaction.message.getAccountKeys({ accountKeysFromLookups: t.meta.loadedAddresses });
  const i = keys.staticAccountKeys.findIndex((k) => k.toBase58() === owner);
  return i >= 0 ? (t.meta.postBalances[i] - t.meta.preBalances[i] + t.meta.fee) / 1e9 : undefined;
}

// Cancel: withdraw everything from the nonce account, which closes it and kills the signed exit.
export async function buildCancel(owner: string, nonce: string) {
  const c = conn();
  const ownerPk = new PublicKey(owner);
  const lamports = await c.getBalance(new PublicKey(nonce));
  const tx = new Transaction().add(SystemProgram.nonceWithdraw({ noncePubkey: new PublicKey(nonce), authorizedPubkey: ownerPk, toPubkey: ownerPk, lamports }));
  tx.feePayer = ownerPk;
  tx.recentBlockhash = (await c.getLatestBlockhash()).blockhash;
  return b64(tx.serialize({ requireAllSignatures: false }));
}

// Keep one Helius webhook watching every wallet any armed exit depends on.
export async function syncWebhook(addresses: string[]) {
  const key = process.env.HELIUS_API_KEY;
  const url = `${process.env.PUBLIC_URL || "https://wingman.jdollar.site"}/api/hooks/helius`;
  const list = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${key}`).then((r) => r.json());
  const mine = (Array.isArray(list) ? list : []).find((w: { webhookURL: string }) => w.webhookURL === url);
  const body = {
    webhookURL: url,
    transactionTypes: ["ANY"],
    accountAddresses: [...new Set(addresses)].slice(0, 25000),
    webhookType: "enhanced",
    authHeader: process.env.HOOK_SECRET,
  };
  const r = await fetch(`https://api.helius.xyz/v0/webhooks${mine ? `/${mine.webhookID}` : ""}?api-key=${key}`, {
    method: mine ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`webhook sync ${r.status}: ${await r.text()}`);
}
