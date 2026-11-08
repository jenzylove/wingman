import { ImageResponse } from "next/og";
import type { Card } from "@/lib/types";
import { loadCard } from "@/lib/ui/server";
import { dur } from "@/lib/ui/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Wingman card: what the caller and their crew did around the post";

const BG = "#05070D";
const INK = "#E8EDF7";
const INK3 = "#6F7A91";
const LINE = "rgba(160,180,220,0.16)";
const AMBER = "#FFB020";
const GREEN = "#3DFFA2";
const RED = "#FF4D4D";

async function font(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Unbounded:wght@${weight}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

const K = 10;
const f = (t: number) => Math.sign(t) * Math.log1p(Math.abs(t) / K);

function strip(card: Card) {
  const lanes = [
    ...card.callerWallets.map((m) => ({ m, color: AMBER })),
    ...card.crew.map((m) => ({ m, color: AMBER })),
    ...card.copyBots.map((m) => ({ m, color: INK3 })),
  ].slice(0, 5);
  const anchor = card.call.postedAt ?? Math.min(...lanes.flatMap((l) => l.m.trades.map((t) => t.ts)), Date.now() / 1000);
  const offs = lanes.flatMap((l) => l.m.trades.map((t) => t.ts - anchor));
  const lo = f(Math.min(-40, ...offs)) - 0.15;
  const hi = f(Math.max(180, ...offs)) + 0.15;
  const W = 1040;
  const x = (t: number) => 20 + (W - 40) * ((f(t) - lo) / (hi - lo));
  return { lanes, anchor, x, W, ticks: [-60, -20, 0, 60, 180, 600, 3600].filter((t) => f(t) >= lo && f(t) <= hi) };
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadCard(id);
  const bold = await font(600);
  const fonts = bold ? [{ name: "Unbounded", data: bold, weight: 600 as const, style: "normal" as const }] : undefined;

  if (!r.ok) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: BG, color: INK, fontFamily: "Unbounded" }}>
          <div style={{ fontSize: 28, color: AMBER, display: "flex" }}>WINGMAN</div>
          <div style={{ fontSize: 64, marginTop: 24, display: "flex" }}>Ride the call. Leave when they leave.</div>
        </div>
      ),
      { ...size, fonts },
    );
  }

  const card = r.data;
  const s = strip(card);
  const token = card.call.token.symbol ? `$${card.call.token.symbol}` : `${card.call.token.address.slice(0, 6)}…`;
  const sold = card.verdict === "sold_into_followers";
  const laneH = s.lanes.length ? Math.min(44, 200 / s.lanes.length) : 44;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "56px 80px", background: BG, color: INK, fontFamily: "Unbounded" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 22, color: INK3 }}>
          <span style={{ color: AMBER }}>WINGMAN</span>
          <span style={{ marginLeft: 24 }}>{card.call.handle ? `@${card.call.handle}` : "Unknown caller"}</span>
          <span style={{ marginLeft: 16 }}>·</span>
          <span style={{ marginLeft: 16, color: INK }}>{token}</span>
          <span style={{ marginLeft: 16 }}>· {card.call.token.chain === "solana" ? "Solana" : "Base"}</span>
        </div>
        <div style={{ display: "flex", fontSize: card.verdictLine.length > 90 ? 40 : 50, lineHeight: 1.15, marginTop: 28, color: INK }}>{card.verdictLine}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 22, color: INK3 }}>
          {card.summary.firstInsiderBuyOffset !== undefined && (
            <span style={{ color: AMBER, marginRight: 32 }}>
              First buy {dur(card.summary.firstInsiderBuyOffset)} {card.summary.firstInsiderBuyOffset < 0 ? "before" : "after"}
            </span>
          )}
          {card.summary.firstInsiderSellOffset !== undefined && (
            <span style={{ color: sold ? RED : INK3 }}>First sell {dur(card.summary.firstInsiderSellOffset)} after</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", position: "relative", width: s.W }}>
          {s.lanes.map((l, i) => (
            <div key={i} style={{ display: "flex", position: "relative", height: laneH, width: s.W, borderBottom: `1px solid ${LINE}` }}>
              {l.m.trades.map((t, j) => {
                const left = s.x(t.ts - s.anchor) - 9;
                return t.side === "buy" ? (
                  <div key={j} style={{ position: "absolute", left, top: laneH / 2 - 8, width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderBottom: `16px solid ${l.color}` }} />
                ) : (
                  <div key={j} style={{ position: "absolute", left, top: laneH / 2 - 8, width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderTop: `16px solid ${RED}` }} />
                );
              })}
            </div>
          ))}
          <div style={{ position: "absolute", left: s.x(0) - 1, top: -10, bottom: -6, width: 3, background: AMBER, display: "flex" }} />
          <div style={{ display: "flex", position: "relative", height: 34, width: s.W }}>
            {s.ticks.map((t) => (
              <span key={t} style={{ position: "absolute", left: s.x(t) - 30, width: 60, top: 10, fontSize: 16, color: t === 0 ? AMBER : INK3, display: "flex", justifyContent: "center" }}>
                {t === 0 ? "POST" : `${t < 0 ? "-" : "+"}${dur(t).replace(" ", "")}`}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 16, color: INK3 }}>
          <span style={{ color: GREEN }}>Ride the call. Leave when they leave.</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
