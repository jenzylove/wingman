import type { ArmedExit, Card, CrewMember } from "@/lib/types";

export interface CallerProfile {
  handle: string;
  wallets: CrewMember[];
  recent: { token: string; ts: number; crewHits: number }[];
}

export interface ProofFeed {
  exits: ArmedExit[];
  cards: Card[];
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readJson<T>(res: Response): Promise<T> {
  let body: unknown = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : res.status === 404
          ? "Not found."
          : `The Wingman API answered with status ${res.status}.`;
    throw new ApiError(msg, res.status);
  }
  if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
    throw new ApiError((body as { error: string }).error, res.status);
  }
  if (body === null) throw new ApiError("The Wingman API sent an empty answer.", res.status);
  return body as T;
}

export async function postCard(input: string, signal?: AbortSignal): Promise<Card> {
  const res = await fetch("/api/card", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input }),
    signal,
  });
  const data = await readJson<{ card: Card }>(res);
  if (!data.card) throw new ApiError("The answer had no card in it.", res.status);
  return data.card;
}

export async function getExits(owner: string): Promise<ArmedExit[]> {
  const res = await fetch(`/api/exits?owner=${encodeURIComponent(owner)}`, { cache: "no-store" });
  const data = await readJson<ArmedExit[] | { exits: ArmedExit[] }>(res);
  return Array.isArray(data) ? data : (data.exits ?? []);
}

export async function getProof(): Promise<ProofFeed> {
  const res = await fetch("/api/proof", { cache: "no-store" });
  const data = await readJson<ProofFeed>(res);
  return { exits: data.exits ?? [], cards: data.cards ?? [] };
}
