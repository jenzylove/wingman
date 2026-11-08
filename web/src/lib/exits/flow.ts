import { randomBytes, timingSafeEqual } from "crypto";
import type { ArmedExit } from "../types";
import { claimOnce, getExit, kvGet, kvSet, saveExit, watchAdd, watchGet, allWatched } from "../store";
import * as sx from "./solana";
import { tradeOf } from "../engine/sol";

// `key` is a per exit secret handed only to whoever started the ride. Prepare and confirm need it.
type Priv = { nonce: string; key: string; unsigned?: string; signed?: string; rideSig?: string; cardId?: string };
const priv = (id: string) => kvGet<Priv>(`exitpriv:${id}`);
const setPriv = (id: string, p: Priv) => kvSet(`exitpriv:${id}`, p);
const isSol = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
const clampSlip = (v: unknown, d: number) => Math.min(3000, Math.max(50, Number.isFinite(Number(v)) ? Number(v) : d));

export class FlowError extends Error {}

function cleanWatch(w: unknown) {
  const watch = [...new Set((Array.isArray(w) ? w : []).filter((x): x is string => typeof x === "string" && isSol(x)))].slice(0, 50);
  if (!watch.length) throw new FlowError("There are no wallets to watch for this call.");
  return watch;
}

function keyOk(p: Priv, key: unknown) {
  if (typeof key !== "string" || key.length !== p.key.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(p.key));
}

export async function ride(b: { owner: string; mint: string; sol: number; slippageBps?: number; watch: string[]; cardId?: string }) {
  if (!isSol(b.owner) || !isSol(b.mint)) throw new FlowError("Bad wallet or token address.");
  if (!(b.sol >= 0.001 && b.sol <= 5)) throw new FlowError("Ride between 0.001 and 5 SOL.");
  const watch = cleanWatch(b.watch);
  const slip = clampSlip(b.slippageBps, 1500);
  const r = await sx.buildRide({ owner: b.owner, mint: b.mint, lamports: String(Math.round(b.sol * 1e9)), slippageBps: slip });
  const id = randomBytes(8).toString("hex");
  const key = randomBytes(16).toString("hex");
  const e: ArmedExit = { id, chain: "solana", owner: b.owner, token: b.mint, watch, amount: "0", maxSlippageBps: slip, status: "pending", armedAt: Math.floor(Date.now() / 1000) };
  await saveExit(e);
  await setPriv(id, { nonce: r.nonce, key, cardId: b.cardId });
  return { id, key, tx: r.tx, quotedTokens: r.quotedTokens };
}

// Arming a token you already hold: just the nonce account first.
export async function holdArm(b: { owner: string; mint: string; watch: string[]; cardId?: string }) {
  if (!isSol(b.owner) || !isSol(b.mint)) throw new FlowError("Bad wallet or token address.");
  const watch = cleanWatch(b.watch);
  const r = await sx.prepareNonce(b.owner);
  const id = randomBytes(8).toString("hex");
  const key = randomBytes(16).toString("hex");
  await saveExit({ id, chain: "solana", owner: b.owner, token: b.mint, watch, amount: "0", maxSlippageBps: 3000, status: "pending", armedAt: Math.floor(Date.now() / 1000) });
  await setPriv(id, { nonce: r.nonce, key, cardId: b.cardId });
  return { id, key, tx: r.tx };
}

// After the ride (or nonce) tx lands: build the exit for everything the owner now holds.
export async function prepareExit(b: { id: string; key: string; sig: string; slippageBps?: number }) {
  const e = await getExit(b.id);
  const p = await priv(b.id);
  if (!e || !p || e.status !== "pending" || !keyOk(p, b.key)) throw new FlowError("Exit not found or already armed.");
  if (!(await sx.confirmed(b.sig))) throw new FlowError("That transaction didn't confirm. Nothing was armed.");
  const bal = await sx.tokenBalanceRaw(e.owner, e.token);
  if (bal.raw === "0") throw new FlowError("No tokens in the wallet to protect yet.");
  const slip = clampSlip(b.slippageBps, 3000);
  const x = await sx.buildExit({ owner: e.owner, mint: e.token, amountRaw: bal.raw, slippageBps: slip, nonce: p.nonce });
  e.amount = bal.raw;
  e.maxSlippageBps = slip;
  e.armTx = b.sig;
  await saveExit(e);
  await setPriv(b.id, { ...p, unsigned: x.tx, rideSig: b.sig });
  return { tx: x.tx, quotedOutLamports: x.quotedOutLamports, minOutLamports: x.minOutLamports };
}

export async function confirmArm(b: { id: string; key: string; signedTx: string }) {
  const e = await getExit(b.id);
  const p = await priv(b.id);
  if (!e || !p?.unsigned || e.status !== "pending" || !keyOk(p, b.key)) throw new FlowError("Nothing to arm.");
  sx.verifySigned(p.unsigned, b.signedTx, e.owner);
  await setPriv(b.id, { ...p, signed: b.signedTx });
  e.status = "armed";
  e.armedAt = Math.floor(Date.now() / 1000);
  await saveExit(e);
  for (const w of e.watch) await watchAdd(w, e.id);
  await sx.syncWebhook(await allWatched());
  return e;
}

export async function cancelTx(id: string, owner: string) {
  const e = await getExit(id);
  const p = await priv(id);
  if (!e || !p || e.owner !== owner) throw new FlowError("Exit not found.");
  return { tx: await sx.buildCancel(owner, p.nonce) };
}

// Only the chain decides: the exit is cancelled once its nonce account no longer exists.
export async function cancelDone(id: string) {
  const e = await getExit(id);
  const p = await priv(id);
  if (!e || !p) throw new FlowError("Exit not found.");
  for (let i = 0; i < 20 && !(await sx.nonceClosed(p.nonce)); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await sx.nonceClosed(p.nonce))) throw new FlowError("The cancel hasn't landed yet. Your exit is still armed.");
  if (e.status === "armed" || e.status === "pending") {
    e.status = "cancelled";
    await saveExit(e);
  }
  return e;
}

type HookTx = Parameters<typeof tradeOf>[0];

// A watched wallet did something. If it sold the token of an armed exit for SOL or a stablecoin, fire that exit.
export async function onActivity(t: HookTx) {
  const fired: string[] = [];
  for (const id of await watchGet(t.feePayer)) {
    const e = await getExit(id);
    if (!e || e.status !== "armed" || e.chain !== "solana") continue;
    const tr = tradeOf(t, e.token);
    if (!tr || tr.side !== "sell" || !(tr.quoteAmount > 0 || (tr.usd ?? 0) > 0)) continue; // a plain transfer is not a sell
    const p = await priv(id);
    if (!p?.signed) continue;
    if (!(await claimOnce(`firing:${id}`))) continue;
    e.trigger = { wallet: t.feePayer, tx: t.signature, ts: t.timestamp };
    const r = await sx.submit(p.signed);
    const now = Math.floor(Date.now() / 1000);
    if (r.ok) {
      e.status = "fired";
      e.exit = { tx: r.sig, ts: now, quoteOut: (await sx.solReceived(r.sig, e.owner)) ?? 0 };
    } else {
      // The signed sell has a fixed minimum. If the price already fell past it, the sell reverts.
      e.status = "failed";
      e.exit = { tx: r.sig, ts: now, quoteOut: 0 };
    }
    await saveExit(e);
    fired.push(id);
  }
  return fired;
}
