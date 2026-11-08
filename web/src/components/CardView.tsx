"use client";

import Link from "next/link";
import { useState } from "react";
import type { Card, CrewMember } from "@/lib/types";
import FlightStrip from "./FlightStrip";
import CoverageMeter from "./CoverageMeter";
import CountUp from "./CountUp";
import RidePanel from "./RidePanel";
import TierBadge from "./TierBadge";
import { addressUrl, chainName, dateTimeUtc, dur, num, quoteSymbol, short, tokenUrl, usd } from "@/lib/ui/format";

const VERDICT: Record<Card["verdict"], { label: string; cls: string }> = {
  sold_into_followers: { label: "Sold into followers", cls: "text-red-ink ring-red" },
  exited: { label: "Insiders already out", cls: "text-amber-ink ring-amber" },
  clean: { label: "No insider selling seen", cls: "text-green-ink ring-green" },
  unknown: { label: "Not enough data", cls: "text-ink-3 ring-line-2" },
};

function Stat({ label, children, sub, tone = "ink" }: { label: string; children: React.ReactNode; sub?: string; tone?: "ink" | "red" | "amber" | "green" }) {
  const toneCls = { ink: "text-ink", red: "text-red-ink", amber: "text-amber-ink", green: "text-green-ink" }[tone];
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-3">{label}</p>
      <p className={`mt-2 font-display text-[22px] font-semibold leading-none sm:text-[26px] ${toneCls}`}>{children}</p>
      {sub && <p className="mt-1.5 text-[12px] text-ink-3">{sub}</p>}
    </div>
  );
}

function OffsetStat({ label, offset, tone, refName = "the post" }: { label: string; offset?: number; tone: "red" | "amber"; refName?: string }) {
  if (offset === undefined || offset === null) {
    return (
      <Stat label={label} sub="No trade seen from known wallets">
        <span className="text-ink-3">None</span>
      </Stat>
    );
  }
  const before = offset < 0;
  return (
    <Stat label={label} tone={tone} sub={offset === 0 ? `Same second as ${refName}` : before ? `before ${refName}` : `after ${refName}`}>
      <CountUp value={Math.abs(offset)} format={(n) => (offset === 0 ? "0s" : dur(n))} />
    </Stat>
  );
}

function WalletList({ title, help, members, chain }: { title: string; help: string; members: CrewMember[]; chain: Card["call"]["token"]["chain"] }) {
  if (members.length === 0) return null;
  return (
    <div>
      <h3 className="font-display text-[14px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-[12px] text-ink-3">{help}</p>
      <ul className="mt-3 divide-y divide-[var(--line)]">
        {members.map((m) => (
          <li key={m.wallet} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:w-[220px] sm:shrink-0">
              <TierBadge tier={m.tier} />
              <a href={addressUrl(chain, m.wallet)} target="_blank" rel="noreferrer" className="truncate text-[13px] text-ink hover:underline">
                {short(m.wallet, 5, 5)}
              </a>
            </div>
            <p className="min-w-0 flex-1 text-[13px] text-ink-2">
              {m.evidence}
              {m.repeat ? <span className="text-ink-3"> ({m.repeat.hits} of {m.repeat.of} calls)</span> : null}
            </p>
            {m.proofUrl && (
              <a href={m.proofUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[12px] text-ink-3 underline underline-offset-2 hover:text-ink">
                Proof
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CardView({ card, shareable = true }: { card: Card; shareable?: boolean }) {
  const [rideOpen, setRideOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { call, summary } = card;
  const chain = call.token.chain;
  const sym = quoteSymbol(chain);
  const tokenName = call.token.symbol ? `$${call.token.symbol}` : short(call.token.address);
  const v = VERDICT[card.verdict];
  const net = summary.insiderNetQuote;

  async function share() {
    const url = `${window.location.origin}/card/${encodeURIComponent(card.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  function postOnX() {
    const url = `${window.location.origin}/card/${encodeURIComponent(card.id)}`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(card.verdictLine)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
  }

  return (
    <article className="fade-up">
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-ink-3">
        <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] ring-1 ${v.cls}`}>{v.label}</span>
        <span>{chainName(chain)}</span>
        <span aria-hidden>·</span>
        <a href={tokenUrl(chain, call.token.address)} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink">
          {tokenName}
          {call.token.name ? <span className="text-ink-3"> {call.token.name}</span> : null}
        </a>
        {call.handle && (
          <>
            <span aria-hidden>·</span>
            <Link href={`/c/${encodeURIComponent(call.handle)}`} className="text-amber-ink hover:underline">
              @{call.handle}
            </Link>
          </>
        )}
        {call.postedAt && (
          <>
            <span aria-hidden>·</span>
            <span>Posted {dateTimeUtc(call.postedAt)}</span>
          </>
        )}
      </div>

      <h1 className="mt-5 max-w-4xl font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-ink text-balance sm:text-[38px]">
        {card.verdictLine}
      </h1>

      {call.text && (
        <blockquote className="mt-5 max-w-2xl border-l-2 border-amber pl-4 text-[14px] leading-relaxed text-ink-2">
          “{call.text}”
          {call.url && (
            <a href={call.url} target="_blank" rel="noreferrer" className="ml-2 text-[12px] text-ink-3 underline underline-offset-2 hover:text-ink">
              Open post
            </a>
          )}
        </blockquote>
      )}

      {/* actions */}
      <div className="mt-7 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRideOpen(true)}
          className="h-11 rounded-xl bg-green px-6 font-display text-[13px] font-semibold text-on-accent transition hover:brightness-110"
        >
          Ride with exit armed
        </button>
        {shareable && (
          <>
            <button type="button" onClick={share} className="h-11 rounded-xl bg-bg-3 px-5 text-[13px] text-ink transition hover:bg-bg-2" aria-live="polite">
              {copied ? "Link copied" : "Share"}
            </button>
            <button type="button" onClick={postOnX} className="h-11 rounded-xl bg-bg-3 px-5 text-[13px] text-ink transition hover:bg-bg-2">
              Post on X
            </button>
          </>
        )}
        {call.handle && (
          <Link href={`/c/${encodeURIComponent(call.handle)}`} className="inline-flex h-11 items-center rounded-xl px-4 text-[13px] text-ink-2 hover:text-ink">
            View caller →
          </Link>
        )}
      </div>

      {/* numbers */}
      <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 hairline-t pt-8 lg:grid-cols-4">
        <OffsetStat label="First insider buy" offset={summary.firstInsiderBuyOffset} tone="amber" refName={typeof card.call.postedAt === "number" ? "the post" : "the caller's first buy"} />
        <OffsetStat label="First insider sell" offset={summary.firstInsiderSellOffset} tone="red" refName={typeof card.call.postedAt === "number" ? "the post" : "the caller's first buy"} />
        <Stat
          label="Insider net take"
          tone={net > 0 ? "red" : "ink"}
          sub={summary.insiderNetUsd !== undefined ? `about ${usd(summary.insiderNetUsd)}` : summary.insidersSold ? "from sells minus buys" : "nothing sold yet"}
        >
          <CountUp value={net} format={(n) => `${n > 0 ? "+" : ""}${num(n, 2)} ${sym}`} />
        </Stat>
        <Stat label="Still holding" sub="of tokens insiders bought">
          <CountUp value={summary.stillHoldingPct} format={(n) => `${Math.round(n)}%`} />
        </Stat>
      </div>

      <div className="mt-10 max-w-3xl">
        <CoverageMeter pct={card.coverage.earlyVolumeAttributedPct} note={card.coverage.note} refName={typeof card.call.postedAt === "number" ? "the post" : "the caller's first buy"} />
      </div>

      {/* flight strip */}
      <section className="mt-14" aria-labelledby="strip-title">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="strip-title" className="font-display text-[13px] font-semibold uppercase tracking-[0.2em] text-ink-2">
            Flight strip
          </h2>
          <p className="text-[12px] text-ink-3">Tap a marker to open its transaction</p>
        </div>
        <div className="mt-4">
          <FlightStrip card={card} />
        </div>
      </section>

      {/* wallets */}
      <section className="mt-14 grid gap-12 lg:grid-cols-2">
        <WalletList title="Caller wallets" help="Wallets we can tie to the caller directly." members={card.callerWallets} chain={chain} />
        <WalletList title="Crew" help="Wallets funded by the caller or that keep buying right before the caller posts." members={card.crew} chain={chain} />
      </section>
      {card.copyBots.length > 0 && (
        <section className="mt-12">
          <WalletList
            title="Copy bots"
            help="Bought right after the caller, every time. They are not the caller, but they also sell into followers."
            members={card.copyBots}
            chain={chain}
          />
        </section>
      )}

      <p className="mt-10 text-[11px] text-ink-3">
        Computed {dateTimeUtc(card.computedAt)} · Card {card.id}
      </p>

      <RidePanel card={card} open={rideOpen} onClose={() => setRideOpen(false)} />
    </article>
  );
}
