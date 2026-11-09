// Tiny persistence layer. Upstash Redis REST when configured, memory otherwise.
import type { ArmedExit, Card, Chain } from "./types";

const URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const mem = new Map<string, string>();
const memLists = new Map<string, string[]>();

async function redis(cmd: (string | number)[]) {
  const r = await fetch(URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`store ${r.status}`);
  return (await r.json()).result;
}

export const storeEnabled = () => Boolean(URL && TOKEN);

export async function kvGet<T>(key: string): Promise<T | null> {
  const v = storeEnabled() ? await redis(["GET", key]) : mem.get(key);
  return v ? (JSON.parse(v) as T) : null;
}
export async function kvSet(key: string, value: unknown, ttlSec?: number) {
  const v = JSON.stringify(value);
  if (storeEnabled()) await redis(ttlSec ? ["SET", key, v, "EX", ttlSec] : ["SET", key, v]);
  else mem.set(key, v);
}
export async function kvDel(key: string) {
  if (storeEnabled()) await redis(["DEL", key]);
  else mem.delete(key);
}
async function listPush(key: string, value: string, cap = 500) {
  if (storeEnabled()) {
    await redis(["LPUSH", key, value]);
    await redis(["LTRIM", key, 0, cap - 1]);
  } else memLists.set(key, [value, ...(memLists.get(key) || [])].slice(0, cap));
}
async function listRange(key: string, n = 50): Promise<string[]> {
  return storeEnabled() ? await redis(["LRANGE", key, 0, n - 1]) : (memLists.get(key) || []).slice(0, n);
}

export async function saveCard(card: Card, publicFeed = true) {
  await kvSet(`card:${card.id}`, card);
  if (publicFeed) await listPush("cards", card.id);
}
export const getCard = (id: string) => kvGet<Card>(`card:${id}`);
export async function recentCards(n = 20): Promise<Card[]> {
  const ids = [...new Set(await listRange("cards", n * 2))].slice(0, n);
  return (await Promise.all(ids.map(getCard))).filter(Boolean) as Card[];
}

export type Claim = { handle: string; chain: Chain; wallet: string; proofUrl?: string; at: number };
export async function getClaims(handle: string): Promise<Claim[]> {
  return (await kvGet<Claim[]>(`claims:${handle.toLowerCase()}`)) || [];
}
export async function addClaim(c: Claim) {
  const all = await getClaims(c.handle);
  if (!all.find((x) => x.wallet === c.wallet)) all.push(c);
  await kvSet(`claims:${c.handle.toLowerCase()}`, all);
}

export async function saveExit(e: ArmedExit) {
  const isNew = !(await kvGet(`exit:${e.id}`));
  await kvSet(`exit:${e.id}`, e);
  if (isNew) {
    await listPush(`exits:${e.owner}`, e.id);
    await listPush("exits", e.id);
  }
}
export const getExit = (id: string) => kvGet<ArmedExit>(`exit:${id}`);
// Pending exits are never listed: their ids are only known to whoever started them.
export async function exitsOf(owner: string) {
  return ((await Promise.all((await listRange(`exits:${owner}`, 100)).map(getExit))).filter(Boolean) as ArmedExit[]).filter((e) => e.status !== "pending");
}
export async function recentExits(n = 50) {
  return ((await Promise.all((await listRange("exits", n)).map(getExit))).filter(Boolean) as ArmedExit[]).filter((e) => e.status !== "pending");
}

// Which armed exits depend on a wallet, so a webhook hit finds them fast.
export async function watchAdd(wallet: string, exitId: string) {
  await listPush(`watch:${wallet}`, exitId, 200);
  await listPush("watched", wallet, 25000);
}
export async function watchGet(wallet: string) {
  return [...new Set(await listRange(`watch:${wallet}`, 200))];
}
export async function allWatched() {
  return [...new Set(await listRange("watched", 25000))];
}

// One winner per key: true only for the first caller within ttl seconds.
export async function claimOnce(key: string, ttlSec = 600): Promise<boolean> {
  if (storeEnabled()) return (await redis(["SET", key, "1", "NX", "EX", ttlSec])) === "OK";
  if (mem.has(key)) return false;
  mem.set(key, "1");
  return true;
}

// Fixed window rate limit per key. Returns false when over the limit.
export async function rateOk(key: string, limit: number, windowSec: number): Promise<boolean> {
  if (!storeEnabled()) return true;
  const n = await redis(["INCR", key]);
  if (n === 1) await redis(["EXPIRE", key, windowSec]);
  return n <= limit;
}
