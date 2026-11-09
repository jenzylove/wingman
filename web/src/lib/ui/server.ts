import { headers } from "next/headers";
import type { Card } from "@/lib/types";
import type { CallerProfile } from "./api";

/** Absolute origin of this deployment, for server side calls to our own API. */
export async function siteOrigin(): Promise<string> {
  // Pinned to our own URL first, so a forged Host header can't point server fetches elsewhere.
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  try {
    const h = await headers();
    const host = h.get("host");
    if (host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  } catch {
    // no request scope
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function load<T>(path: string): Promise<Loaded<T>> {
  try {
    const origin = await siteOrigin();
    const res = await fetch(`${origin}${path}`, { cache: "no-store" });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok || !body || (typeof body === "object" && "error" in body)) {
      const err =
        body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : res.status === 404 ? "Not found." : `The Wingman API answered with status ${res.status}.`;
      return { ok: false, status: res.status, error: err };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, error: "Could not reach the Wingman API." };
  }
}

export async function loadCard(id: string): Promise<Loaded<Card>> {
  const r = await load<{ card: Card }>(`/api/card/${encodeURIComponent(id)}`);
  if (!r.ok) return r;
  if (!r.data.card) return { ok: false, status: 500, error: "The answer had no card in it." };
  return { ok: true, data: r.data.card };
}

export async function loadCaller(handle: string): Promise<Loaded<CallerProfile>> {
  return load<CallerProfile>(`/api/caller/${encodeURIComponent(handle)}`);
}
