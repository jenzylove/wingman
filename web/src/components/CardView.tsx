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
  sold_into_followers: { label: "Sold into followers", cls: "bg-accent text-on-accent border-accent" },
  exited: { label: "Insiders already out", cls: "text-accent-ink border-accent" },
  clean: { label: "No insider selling seen", cls: "text-ink border-ink" },
  unknown: { label: "Not enough data", cls: "text-ink-2 border-line-2" },
};

function Stat({ label, children, sub, tone = "ink" }: { label: string; children: React.ReactNode; sub?: string; tone?: "ink" | "accent" }) {
  const toneCls = { ink: "text-ink", accent: "text-accent" }[tone];
  return (
    <div className="min-w-0 border-t border-line-2 pt-4">
      <p className="label">{label}</p>
      <p className={`mt-3 font-display text-[36px] leading-none normal-case sm:text-[48px] ${toneCls}`}>{children}</p>
      {sub && <p className="mt-2 text-[12px] text-ink-3">{sub}</p>}
    </div>
  );
}

function OffsetStat({ label, offset, tone, refName = "the post" }: { label: string; offset?: number; tone: "accent" | "ink"; refName?: string }) {
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
      <h3 className="flex items-baseline gap-3 font-display text-[26px] leading-none text-ink">
        {title} <span className="font-mono text-[12px] tracking-normal text-ink-3">{members.length}</span>
      </h3>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-3">{help}</p>
      <ul className="mt-4 divide-y divide-[var(--line)] border-y border-line-2">
        {members.map((m) => (
          <li key={m.wallet} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:w-[220px] sm:shrink-0">
              <TierBadge tier={m.tier} />
              <a href={addressUrl(chain, m.wallet)} target="_blank" rel="noreferrer" className="link truncate font-mono text-[13px] text-ink">
                {short(m.wallet, 5, 5)}
              </a>
            </div>
            <p className="min-w-0 flex-1 text-[13px] text-ink-2">
              {m.evidence}
              {m.repeat ? <span className="text-ink-3"> ({m.repeat.hits} of {m.repeat.of} calls)</span> : null}
            </p>
            {m.proofUrl && (
              <a href={m.proofUrl} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink">
                Proof ↗
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
  const early = card.early ?? [];

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[12px] text-ink-3">
        <span className={`inline-flex h-6 items-center border px-2 text-[11px] uppercase tracking-[0.14em] ${v.cls}`}>{v.label}</span>
        <span>{chainName(chain)}</span>
        <span aria-hidden>·</span>
        <a href={tokenUrl(chain, call.token.address)} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink">
          {tokenName}
          {call.token.name ? <span className="text-ink-3"> {call.token.name}</span> : null}
        </a>
        {call.handle && (
          <>
            <span aria-hidden>·</span>
            <Link href={`/c/${encodeURIComponent(call.handle)}`} className="link text-ink">
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

      <h1 className="mt-6 max-w-5xl font-display text-[38px] leading-[0.95] normal-case text-ink text-balance sm:text-[60px] lg:text-[72px]">
        {card.verdictLine}
      </h1>

      {call.text && (
        <blockquote className="mt-6 max-w-2xl border-l border-line-2 pl-4 text-[15px] leading-relaxed text-ink-2">
          “{call.text}”
          {call.url && (
            <a href={call.url} target="_blank" rel="noreferrer" className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink">
              Open post ↗
            </a>
          )}
        </blockquote>
      )}

      {/* actions */}
      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRideOpen(true)}
          className="group inline-flex h-12 items-center gap-3 bg-accent px-6 font-display text-[20px] text-on-accent transition hover:brightness-110 active:scale-[0.98]"
        >
          Ride with exit armed <span className="nudge" aria-hidden>↗</span>
        </button>
        {shareable && (
          <>
            <button type="button" onClick={share} className="h-12 border border-line-2 px-5 font-mono text-[12px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink" aria-live="polite">
              {copied ? "Link copied" : "Share"}
            </button>
            <button type="button" onClick={postOnX} className="h-12 border border-line-2 px-5 font-mono text-[12px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink">
              Post on X
            </button>
          </>
        )}
        {call.handle && (
          <Link href={`/c/${encodeURIComponent(call.handle)}`} className="group inline-flex h-12 items-center gap-2 px-4 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink">
            View caller <span className="nudge" aria-hidden>→</span>
          </Link>
        )}
      </div>

      {/* numbers */}
      <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
        <OffsetStat label="First insider buy" offset={summary.firstInsiderBuyOffset} tone="ink" refName={typeof card.call.postedAt === "number" ? "the post" : "the caller's first buy"} />
        <OffsetStat label="First insider sell" offset={summary.firstInsiderSellOffset} tone="accent" refName={typeof card.call.postedAt === "number" ? "the post" : "the caller's first buy"} />
        <Stat
          label="Insider net take"
          tone={net > 0 ? "accent" : "ink"}
          sub={summary.insiderNetUsd !== undefined ? `about ${usd(summary.insiderNetUsd)}` : summary.insidersSold ? "from sells minus buys" : "nothing sold yet"}
        >
          <CountUp value={net} format={(n) => `${n > 0 ? "+" : ""}${num(n, 2)} ${sym}`} />
        </Stat>
        <Stat label="Still holding" sub="of tokens insiders bought">
          <CountUp value={summary.stillHoldingPct} format={(n) => `${Math.round(n)}%`} />
        </Stat>
      </div>

      <div className="mt-12 max-w-3xl">
        <CoverageMeter pct={card.coverage.earlyVolumeAttributedPct} note={card.coverage.note} refName={typeof card.call.postedAt === "number" ? "the post" : "the caller's first buy"} />
      </div>

      {/* flight strip */}
      <section className="mt-16" aria-labelledby="strip-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="strip-title" className="font-display text-[32px] leading-none text-ink sm:text-[40px]">
            Flight strip
          </h2>
          <p className="text-[12px] text-ink-3">Tap a marker to open its transaction</p>
        </div>
        <div className="mt-4">
          <FlightStrip card={card} />
        </div>
      </section>

      {/* wallets */}
      <section className="mt-16 grid gap-14 lg:grid-cols-2">
        <WalletList title="Caller wallets" help="Wallets the caller claimed, or that are linked to them on the public Kolscan KOL list or a verified Farcaster account." members={card.callerWallets} chain={chain} />
        <WalletList title="Crew" help="Wallets that keep buying with this caller across recent tokens, or were early on 2 or more of their posts." members={card.crew} chain={chain} />
      </section>
      {early.length > 0 && (
        <section className="mt-14">
          <WalletList
            title="Early buyers"
            help="Bought in the 3 minutes before the post. Not tied to the caller yet. A wallet early on 2 or more of this caller's posts becomes crew."
            members={early}
            chain={chain}
          />
        </section>
      )}
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

      <p className="mt-12 font-mono text-[11px] text-ink-3">
        Computed {dateTimeUtc(card.computedAt)} · Card {card.id}
      </p>

      <RidePanel card={card} open={rideOpen} onClose={() => setRideOpen(false)} />
    </article>
  );
}
