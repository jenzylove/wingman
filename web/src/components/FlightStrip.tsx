"use client";

import { useMemo } from "react";
import type { Card, Chain, CrewMember, Trade } from "@/lib/types";
import TierBadge from "./TierBadge";
import { addressUrl, dur, num, short, tLabel, txUrl, usd } from "@/lib/ui/format";

type Role = "caller" | "crew" | "early" | "bot";

interface Lane {
  member: CrewMember;
  role: Role;
}

const K = 10; // seconds; the scale is linear near the post and stretches out beyond
const f = (t: number) => Math.sign(t) * Math.log1p(Math.abs(t) / K);

const TICKS = [-86400, -21600, -3600, -1800, -600, -300, -120, -60, -40, -20, -10, 0, 10, 20, 40, 60, 180, 600, 1800, 3600, 21600, 86400];

const ROLE_COLOR: Record<Role, string> = {
  caller: "var(--ink)",
  crew: "var(--ink)",
  early: "var(--ink-2)",
  bot: "var(--ink-3)",
};

const ROLE_TITLE: Record<Role, string> = {
  caller: "Caller wallets",
  crew: "Crew",
  early: "Early buyers: bought in the 3 minutes before the post",
  bot: "Copy bots",
};

function Triangle({ side, color }: { side: Trade["side"]; color: string }) {
  return side === "buy" ? (
    <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden>
      <path d="M6.5 0.5 L12.5 11.5 L0.5 11.5 Z" fill={color} />
    </svg>
  ) : (
    <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden>
      <path d="M0.5 0.5 L12.5 0.5 L6.5 11.5 Z" fill="var(--accent)" />
    </svg>
  );
}

export default function FlightStrip({ card, animate = true }: { card: Card; animate?: boolean }) {
  const chain: Chain = card.call.token.chain;
  const lanes: Lane[] = useMemo(
    () => [
      ...card.callerWallets.map((m) => ({ member: m, role: "caller" as const })),
      ...card.crew.map((m) => ({ member: m, role: "crew" as const })),
      ...(card.early ?? []).map((m) => ({ member: m, role: "early" as const })),
      ...card.copyBots.map((m) => ({ member: m, role: "bot" as const })),
    ],
    [card],
  );

  const allTrades = lanes.flatMap((l) => l.member.trades);
  const hasPost = typeof card.call.postedAt === "number";
  const anchor = hasPost ? (card.call.postedAt as number) : allTrades.length ? Math.min(...allTrades.map((t) => t.ts)) : 0;
  const anchorLabel = hasPost ? "POST" : "FIRST BUY";

  const offsets = allTrades.map((t) => t.ts - anchor);
  const tMin = Math.min(-40, ...offsets);
  const tMax = Math.max(180, ...offsets);
  const fMin = f(tMin) - 0.15;
  const fMax = f(tMax) + 0.15;
  // rounded so server and client print the same style string
  const pct = (t: number) => Math.round((3 + 94 * ((f(t) - fMin) / (fMax - fMin))) * 1000) / 1000;

  // keep ticks that fit, always keep 0
  const ticks: number[] = [];
  for (const t of TICKS.filter((t) => t >= tMin && t <= tMax)) {
    const p = pct(t);
    const tooClose = ticks.some((x) => Math.abs(pct(x) - p) < 9);
    if (t === 0) {
      for (let i = ticks.length - 1; i >= 0; i--) if (Math.abs(pct(ticks[i]) - p) < 9) ticks.splice(i, 1);
      ticks.push(0);
    } else if (!tooClose) ticks.push(t);
  }

  const postX = pct(0);
  const order = [...offsets].sort((a, b) => a - b);

  if (lanes.length === 0) {
    return (
      <div className="dotfield relative overflow-hidden border-y border-line-2 px-5 py-12 text-center">
        <p className="font-display text-[24px] leading-tight text-ink">No known wallets for this caller yet. Coverage {Math.round(card.coverage.earlyVolumeAttributedPct)}%.</p>
        <p className="mx-auto mt-3 max-w-md bg-bg text-[13px] text-ink-2">
          We did not find wallets we can tie to this caller or a crew around this post. That is not proof they did not trade; it means we cannot see it yet.
        </p>
      </div>
    );
  }

  let group: Role | null = null;

  return (
    <figure className="relative" aria-label="Timeline of insider trades around the post">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <Triangle side="buy" color="var(--ink)" /> Buy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Triangle side="sell" color="" /> Sell into followers
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-[2px] bg-ink" /> {hasPost ? "The post" : "First buy"}
        </span>
        <span className="ml-auto hidden font-sans normal-case tracking-normal sm:inline">Time is stretched near the post so seconds stay readable.</span>
      </div>

      <div className="relative mt-8 border-y border-line-2 py-3">
        {/* overlay: before zone, gridlines, post line */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 sm:left-[210px]" aria-hidden>
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${postX}%`,
              backgroundImage: "radial-gradient(rgba(242,239,233,0.16) 1px, transparent 1.2px)",
              backgroundSize: "10px 10px",
            }}
          />
          {ticks
            .filter((t) => t !== 0)
            .map((t) => (
              <div key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: `${pct(t)}%` }} />
            ))}
          <div className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-ink shadow-[0_0_16px_rgba(242,239,233,0.35)]" style={{ left: `${postX}%` }} />
          <div
            className="absolute top-0 -translate-x-1/2 -translate-y-[calc(100%+4px)] bg-ink px-1.5 py-0.5 font-display text-[12px] leading-none tracking-wider text-bg"
            style={{ left: `${postX}%` }}
          >
            {anchorLabel}
          </div>
        </div>

        <ol className="relative">
          {lanes.map((lane, li) => {
            const header = lane.role !== group;
            group = lane.role;
            const color = ROLE_COLOR[lane.role];
            return (
              <li key={`${lane.role}-${lane.member.wallet}`}>
                {header && (
                  <p className={`relative px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] sm:px-4 ${lane.role === "early" ? "text-ink-2" : "text-ink-3"} ${li > 0 ? "mt-2 pt-2 hairline-t" : ""}`}>
                    <span className="bg-bg pr-2">{ROLE_TITLE[lane.role]}</span>
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-[210px_1fr]">
                  <div className="relative z-10 flex min-w-0 items-center gap-2 px-3 pt-1 sm:px-4 sm:pt-0">
                    <span className="bg-bg pr-1">
                      <TierBadge tier={lane.member.tier} />
                    </span>
                    <a
                      href={addressUrl(chain, lane.member.wallet)}
                      target="_blank"
                      rel="noreferrer"
                      title={lane.member.evidence}
                      className="truncate bg-bg font-mono text-[12px] text-ink-2 hover:text-ink"
                    >
                      {short(lane.member.wallet)}
                    </a>
                  </div>
                  <div className={`relative h-9 ${animate ? "lane-in" : ""}`} style={animate ? { animationDelay: `${li * 70}ms` } : undefined}>
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-line-2" />
                    {lane.member.trades.map((t) => {
                      const off = t.ts - anchor;
                      const rank = order.indexOf(off);
                      const label = `${t.side === "buy" ? "Bought" : "Sold"} ${num(t.quoteAmount, 3)} ${t.quoteSymbol}${t.usd ? ` (${usd(t.usd)})` : ""}, ${
                        off === 0 ? "at the post" : `${dur(off)} ${off < 0 ? "before" : "after"} the ${hasPost ? "post" : "first buy"}`
                      }`;
                      return (
                        <a
                          key={t.tx + t.side + t.ts}
                          href={txUrl(chain, t.tx)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${label}. Open transaction`}
                          className={`group absolute top-1/2 z-10 grid h-6 w-6 place-items-center rounded-full outline-none hover:z-20 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-accent ${animate ? "marker-in" : ""}`}
                          style={{
                            left: `${pct(off)}%`,
                            transform: "translate(-50%, -50%)",
                            animationDelay: animate ? `${300 + rank * 90}ms` : undefined,
                          }}
                        >
                          <Triangle side={t.side} color={color} />
                          <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden w-max max-w-[220px] -translate-x-1/2 bg-ink px-2 py-1 font-mono text-[11px] leading-snug text-bg shadow-lg group-hover:block group-focus-visible:block">
                            {label}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* axis */}
        <div className="relative mt-2 grid grid-cols-1 sm:grid-cols-[210px_1fr]">
          <div className="hidden sm:block" />
          <div className="relative h-6">
            {ticks.map((t) => (
              <span
                key={t}
                className={`absolute top-1 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tabular-nums ${t === 0 ? "text-ink" : "text-ink-3"}`}
                style={{ left: `${pct(t)}%` }}
              >
                {t === 0 ? anchorLabel : tLabel(t)}
              </span>
            ))}
          </div>
        </div>
      </div>
      {!hasPost && (
        <figcaption className="mt-2 text-[12px] text-ink-3">
          We could not pin the exact post time, so this strip is measured from the first insider buy.
        </figcaption>
      )}
    </figure>
  );
}
