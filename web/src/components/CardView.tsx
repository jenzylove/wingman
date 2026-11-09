"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Card, CrewMember } from "@/lib/types";
import FlightStrip from "./FlightStrip";
import CoverageMeter from "./CoverageMeter";
import CountUp from "./CountUp";
import RidePanel, { type RideOptions } from "./RidePanel";
import StoryTimeline from "./StoryTimeline";
import { postCard } from "@/lib/ui/api";
import { STANCE_HEADLINE, recheckInput, sellNowUrl, stanceOf } from "@/lib/ui/stance";
import TierBadge from "./TierBadge";
import { addressUrl, chainName, dateTimeUtc, dur, num, quoteSymbol, short, toMs, tokenUrl, usd } from "@/lib/ui/format";

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

const STALE_SECONDS = 600;

function ageSeconds(computedAt: number, now: number) {
  return Math.max(0, (now - toMs(computedAt)) / 1000);
}

function ageWords(s: number) {
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${dur(s)} ago`;
}

type Action = { label: string; sub?: string; onClick?: () => void; href?: string; kind: "primary" | "secondary" };

export default function CardView({ card: initial, shareable = true }: { card: Card; shareable?: boolean }) {
  const [card, setCard] = useState(initial);
  const [rideOpen, setRideOpen] = useState(false);
  const [rideOptions, setRideOptions] = useState<RideOptions>({ mode: "ride" });
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [changed, setChanged] = useState<string | null>(null);
  const { call, summary } = card;
  const chain = call.token.chain;
  const sym = quoteSymbol(chain);
  const tokenName = call.token.symbol ? `$${call.token.symbol}` : short(call.token.address);
  const v = VERDICT[card.verdict];
  const net = summary.insiderNetQuote;
  const early = card.early ?? [];
  const st = useMemo(() => stanceOf(card), [card]);

  useEffect(() => setCard(initial), [initial]);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function recheck(): Promise<Card | null> {
    setChecking(true);
    setCheckError(null);
    try {
      const fresh = await postCard(recheckInput(card));
      setCard(fresh);
      setNow(Date.now());
      try {
        if (window.location.pathname.startsWith("/card/") || window.location.pathname.startsWith("/check")) {
          window.history.replaceState(null, "", `/card/${encodeURIComponent(fresh.id)}`);
        }
      } catch {
        // the share button still gives the card link
      }
      return fresh;
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "Could not recheck this call.");
      return null;
    } finally {
      setChecking(false);
    }
  }

  /** Opens the ride panel. A card older than 10 minutes is rechecked first; if the stance moved, show it instead. */
  async function openRide(build: (c: Card) => RideOptions) {
    setChanged(null);
    let c = card;
    if (ageSeconds(card.computedAt, Date.now()) > STALE_SECONDS) {
      const fresh = await recheck();
      if (!fresh) return;
      const before = stanceOf(card).stance;
      const after = stanceOf(fresh).stance;
      if (before !== after) {
        setChanged(`Rechecked just now and the crew moved: ${STANCE_HEADLINE[after]} Look again before you ride.`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      c = fresh;
    }
    setRideOptions({ ...build(c), status: `Checked ${ageWords(ageSeconds(c.computedAt, Date.now()))}: ${STANCE_HEADLINE[stanceOf(c).stance]}` });
    setRideOpen(true);
  }

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
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(`${STANCE_HEADLINE[st.stance]} ${card.verdictLine}`)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
  }

  const holdingWallets = (c: Card) => stanceOf(c).holding.map((m) => m.wallet);
  const callerOnly = card.callerWallets.map((m) => m.wallet);
  const anythingToWatch = card.callerWallets.length + card.crew.length + early.length > 0;

  const actions: Action[] = [];
  let actionNote: string | null = null;
  if (st.stance === "in") {
    actions.push({ kind: "primary", label: "Ride: buy with exit armed", onClick: () => openRide(() => ({ mode: "ride" })) });
    actions.push({ kind: "secondary", label: "I already hold it: arm exit only", onClick: () => openRide(() => ({ mode: "hold" })) });
    actionNote = "Buys right here from your own wallet: one wallet popup to buy, then you sign the exit. Nothing leaves this page.";
  } else if (st.stance === "selling") {
    actions.push({
      kind: "primary",
      label: "I hold it: arm exit on the ones still in",
      onClick: () => openRide((c) => ({ mode: "hold", watch: holdingWallets(c) })),
    });
    actions.push({
      kind: "secondary",
      label: "Ride anyway",
      onClick: () => openRide((c) => ({ mode: "ride", watch: holdingWallets(c), warning: "Part of the crew already sold. You would be buying while they leave." })),
    });
    actionNote = `${st.holding.length} insider ${st.holding.length === 1 ? "wallet is" : "wallets are"} still holding. Your exit watches them.`;
  } else if (st.stance === "out") {
    actions.push({ kind: "primary", label: "I hold it: sell now", href: sellNowUrl(card), sub: chain === "solana" ? "Opens Jupiter" : "Opens Uniswap" });
    if (st.holding.length > 0) {
      actions.push({ kind: "secondary", label: "Arm exit on anyone still holding", onClick: () => openRide((c) => ({ mode: "hold", watch: holdingWallets(c) })) });
    }
    actionNote = "No buy offered here: the people who made this call have already left.";
  } else if (anythingToWatch && card.callerWallets.length > 0) {
    actions.push({
      kind: "primary",
      label: "Ride with exit on the caller's wallets",
      onClick: () => openRide(() => ({ mode: "ride", watch: callerOnly, warning: "Weaker cover: we saw no crew trades, so the exit only watches the caller's known wallets." })),
    });
    actions.push({ kind: "secondary", label: "I already hold it: arm exit only", onClick: () => openRide(() => ({ mode: "hold", watch: callerOnly })) });
    actionNote = "Weaker cover. We could not see a crew on this call, only the caller's own wallets.";
  } else {
    actionNote = "We know no wallets for this caller yet, so there is nothing to arm an exit against.";
  }

  const age = now !== null ? ageSeconds(card.computedAt, now) : null;
  const refName = typeof card.call.postedAt === "number" ? "the post" : "the caller's first buy";

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

      <h1 className={`mt-6 max-w-6xl font-display text-[60px] leading-[0.9] text-balance sm:text-[104px] lg:text-[136px] ${st.stance === "out" || st.stance === "selling" ? "text-accent" : "text-ink"}`}>
        {STANCE_HEADLINE[st.stance]}
      </h1>
      <p className="mt-5 max-w-3xl text-[18px] leading-snug text-ink-2 sm:text-[22px]">{card.verdictLine}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-ink-3" aria-live="polite">
        <span>{checking ? "Rechecking…" : age === null ? `Checked ${dateTimeUtc(card.computedAt)}` : `Checked ${ageWords(age)}`}</span>
        <span aria-hidden>·</span>
        <button type="button" onClick={() => void recheck()} disabled={checking} className="link uppercase tracking-[0.14em] text-ink hover:text-accent-ink disabled:text-ink-3">
          Recheck
        </button>
        {age !== null && age > STALE_SECONDS && !checking && <span className="text-ink-2">Older than 10 min. We recheck before you ride.</span>}
      </div>
      {checkError && (
        <p role="alert" className="mt-3 text-[13px] text-accent-ink">
          {checkError}
        </p>
      )}
      {changed && (
        <p role="alert" className="mt-4 max-w-3xl border-l-2 border-accent pl-3 text-[15px] leading-relaxed text-ink">
          {changed}
        </p>
      )}

      {call.text && (
        <blockquote className="mt-8 max-w-2xl border-l border-line-2 pl-4 text-[15px] leading-relaxed text-ink-2">
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
        {actions.map((a) => {
          const cls =
            a.kind === "primary"
              ? "group inline-flex min-h-12 items-center gap-3 bg-accent px-6 py-2 text-left font-display text-[20px] leading-tight text-on-accent transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              : "group inline-flex min-h-12 items-center gap-3 border border-ink px-5 py-2 text-left font-display text-[18px] leading-tight text-ink transition-colors hover:bg-ink hover:text-bg disabled:opacity-60";
          return a.href ? (
            <a key={a.label} href={a.href} target="_blank" rel="noreferrer" className={cls}>
              {a.label} <span className="nudge" aria-hidden>↗</span>
              {a.sub && <span className="font-mono text-[10px] normal-case tracking-[0.1em] opacity-70">{a.sub}</span>}
            </a>
          ) : (
            <button key={a.label} type="button" onClick={a.onClick} disabled={checking} className={cls}>
              {a.label} <span className="nudge" aria-hidden>{a.kind === "primary" ? "↗" : "→"}</span>
            </button>
          );
        })}
      </div>
      {actionNote && <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-3">{actionNote}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {shareable && (
          <>
            <button type="button" onClick={share} className="h-10 border border-line-2 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink" aria-live="polite">
              {copied ? "Link copied" : "Share"}
            </button>
            <button type="button" onClick={postOnX} className="h-10 border border-line-2 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink">
              Post on X
            </button>
          </>
        )}
        {call.handle && (
          <Link href={`/c/${encodeURIComponent(call.handle)}`} className="group inline-flex h-10 items-center gap-2 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink">
            View caller <span className="nudge" aria-hidden>→</span>
          </Link>
        )}
      </div>

      {/* story */}
      <section className="mt-16" aria-labelledby="story-title">
        <h2 id="story-title" className="font-display text-[32px] leading-none text-ink sm:text-[40px]">
          What happened
        </h2>
        <p className="mt-2 text-[13px] text-ink-3">Times in UTC. Tap a line to open its transaction.</p>
        <div className="mt-6">
          <StoryTimeline card={card} />
        </div>
        {st.stance !== "none" && (
        <details className="group mt-6">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink">
            <span className="transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
            Show every trade
          </summary>
          <div className="mt-8">
            <FlightStrip card={card} />
          </div>
        </details>
        )}
      </section>

      {/* numbers */}
      <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
        <OffsetStat label="First insider buy" offset={summary.firstInsiderBuyOffset} tone="ink" refName={refName} />
        <OffsetStat label="First insider sell" offset={summary.firstInsiderSellOffset} tone="accent" refName={refName} />
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
        <CoverageMeter pct={card.coverage.earlyVolumeAttributedPct} note={card.coverage.note} refName={refName} />
      </div>

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

      <RidePanel card={card} open={rideOpen} onClose={() => setRideOpen(false)} options={rideOptions} />
    </article>
  );
}
