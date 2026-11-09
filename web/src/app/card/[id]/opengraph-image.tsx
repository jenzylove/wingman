import { ImageResponse } from "next/og";
import type { Card } from "@/lib/types";
import { loadCard } from "@/lib/ui/server";
import { dur } from "@/lib/ui/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Wingman card: what the caller and their crew did around the post";

const BG = "#050505";
const INK = "#F2EFE9";
const INK2 = "#B4B4B4";
const INK3 = "#8A8A8A";
const LINE = "rgba(255,255,255,0.12)";
const ACCENT = "#FF3B1F";

async function font(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

async function fonts() {
  const [anton, mono] = await Promise.all([font("Anton", 400), font("JetBrains+Mono", 500)]);
  const out: { name: string; data: ArrayBuffer; weight: 400 | 500; style: "normal" }[] = [];
  if (anton) out.push({ name: "Anton", data: anton, weight: 400, style: "normal" });
  if (mono) out.push({ name: "Mono", data: mono, weight: 500, style: "normal" });
  return out.length ? out : undefined;
}

/** The chevron formation logo mark. */
function Mark({ s = 1 }: { s?: number }) {
  return (
    <svg width={32 * s} height={26 * s} viewBox="0 0 32 26">
      <path d="M16 3 L24 13 L19.5 13 L16 8.6 L12.5 13 L8 13 Z" fill={ACCENT} />
      <path d="M7 15 L13.5 23 L9.5 23 L7 19.8 L4.5 23 L0.5 23 Z" fill={ACCENT} />
      <path d="M25 15 L31.5 23 L27.5 23 L25 19.8 L22.5 23 L18.5 23 Z" fill={ACCENT} />
    </svg>
  );
}

const K = 10;
const f = (t: number) => Math.sign(t) * Math.log1p(Math.abs(t) / K);

function strip(card: Card) {
  const lanes = [
    ...card.callerWallets.map((m) => ({ m, color: INK })),
    ...card.crew.map((m) => ({ m, color: INK })),
    ...(card.early ?? []).map((m) => ({ m, color: INK2 })),
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
  const [r, fontList] = await Promise.all([loadCard(id), fonts()]);

  if (!r.ok) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: BG, color: INK, fontFamily: "Anton" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 34, letterSpacing: 2 }}>
            <Mark s={1.6} />
            <span style={{ marginLeft: 16 }}>WINGMAN</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 120, lineHeight: 0.9, marginTop: 36 }}>
            <span>RIDE THE CALL.</span>
            <span style={{ color: ACCENT }}>LEAVE WHEN THEY LEAVE.</span>
          </div>
        </div>
      ),
      { ...size, fonts: fontList },
    );
  }

  const card = r.data;
  const s = strip(card);
  const token = card.call.token.symbol ? `$${card.call.token.symbol}` : `${card.call.token.address.slice(0, 6)}…`;
  const laneH = s.lanes.length ? Math.min(40, 180 / s.lanes.length) : 40;
  const line = card.verdictLine;
  const fs = line.length > 90 ? 52 : line.length > 60 ? 62 : 74;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "52px 80px 44px", background: BG, color: INK, fontFamily: "Anton" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 20, color: INK3, fontFamily: "Mono", letterSpacing: 1 }}>
          <Mark s={1.1} />
          <span style={{ marginLeft: 14, color: INK, fontFamily: "Anton", fontSize: 28, letterSpacing: 2 }}>WINGMAN</span>
          <span style={{ marginLeft: 28 }}>{card.call.handle ? `@${card.call.handle}` : "unknown caller"}</span>
          <span style={{ marginLeft: 16, color: INK }}>{token}</span>
          <span style={{ marginLeft: 16 }}>{card.call.token.chain === "solana" ? "SOLANA" : "BASE"}</span>
        </div>
        <div style={{ display: "flex", fontSize: fs, lineHeight: 0.95, marginTop: 30, color: INK }}>{line}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 20, color: INK3, fontFamily: "Mono" }}>
          {card.summary.firstInsiderBuyOffset !== undefined && (
            <span style={{ color: INK, marginRight: 36 }}>
              FIRST BUY {dur(card.summary.firstInsiderBuyOffset)} {card.summary.firstInsiderBuyOffset < 0 ? "BEFORE" : "AFTER"}
            </span>
          )}
          {card.summary.firstInsiderSellOffset !== undefined && (
            <span style={{ color: ACCENT }}>FIRST SELL {dur(card.summary.firstInsiderSellOffset)} AFTER</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", position: "relative", width: s.W, borderTop: `1px solid ${LINE}` }}>
          {s.lanes.map((l, i) => (
            <div key={i} style={{ display: "flex", position: "relative", height: laneH, width: s.W, borderBottom: `1px solid ${LINE}` }}>
              {l.m.trades.map((t, j) => {
                const left = s.x(t.ts - s.anchor) - 9;
                return (
                  <svg key={j} width="18" height="16" viewBox="0 0 18 16" style={{ position: "absolute", left, top: laneH / 2 - 8 }}>
                    {t.side === "buy" ? <path d="M9 0 L18 16 L0 16 Z" fill={l.color} /> : <path d="M0 0 L18 0 L9 16 Z" fill={ACCENT} />}
                  </svg>
                );
              })}
            </div>
          ))}
          <div style={{ position: "absolute", left: s.x(0) - 1, top: -10, bottom: -6, width: 2, background: INK, display: "flex" }} />
          <div style={{ display: "flex", position: "relative", height: 34, width: s.W }}>
            {s.ticks.map((t) => (
              <span key={t} style={{ position: "absolute", left: s.x(t) - 30, width: 60, top: 10, fontSize: 15, fontFamily: "Mono", color: t === 0 ? INK : INK3, display: "flex", justifyContent: "center" }}>
                {t === 0 ? (card.call.postedAt ? "POST" : "FIRST BUY") : `${t < 0 ? "-" : "+"}${dur(t).replace(" ", "")}`}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 26, letterSpacing: 1 }}>
          <span>RIDE THE CALL.</span>
          <span style={{ marginLeft: 12, color: ACCENT }}>LEAVE WHEN THEY LEAVE.</span>
        </div>
      </div>
    ),
    { ...size, fonts: fontList },
  );
}
