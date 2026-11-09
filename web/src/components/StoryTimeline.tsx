import type { Card, CrewMember, Trade } from "@/lib/types";
import { stanceOf } from "@/lib/ui/stance";
import { clock, dur, txUrl } from "@/lib/ui/format";

interface Line {
  ts: number;
  text: string;
  tx?: string;
  tone?: "accent" | "sell" | "plain";
  note?: string;
  order: number;
}

function firstBuy(m: CrewMember): Trade | undefined {
  return m.trades.filter((t) => t.side === "buy").sort((a, b) => a.ts - b.ts)[0];
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/**
 * The card in plain sentences, top to bottom: who bought, when the post went up,
 * when the crew started selling and whether anyone is still in. Every line links to its transaction.
 */
export default function StoryTimeline({ card }: { card: Card }) {
  const chain = card.call.token.chain;
  const { insiders, earlyOnly, holding, stance } = stanceOf(card);
  const posted = typeof card.call.postedAt === "number" ? card.call.postedAt : undefined;
  const who = card.call.handle ? `@${card.call.handle}` : "The caller";
  const group = earlyOnly ? "Early buyers" : "Crew";
  const lines: Line[] = [];

  if (!earlyOnly) {
    // the caller's own first buy
    const callerBuys = card.callerWallets.map(firstBuy).filter((t): t is Trade => !!t).sort((a, b) => a.ts - b.ts);
    if (callerBuys[0]) lines.push({ ts: callerBuys[0].ts, text: `${who} bought`, tx: callerBuys[0].tx, order: 1 });

    // crew first buys, grouped when they land within a second of each other
    const crewBuys = card.crew.map(firstBuy).filter((t): t is Trade => !!t).sort((a, b) => a.ts - b.ts);
    const clusters: Trade[][] = [];
    for (const t of crewBuys) {
      const last = clusters[clusters.length - 1];
      if (last && t.ts - last[last.length - 1].ts <= 1) last.push(t);
      else clusters.push([t]);
    }
    // a burst of wallets in the same second gets its own line (two at most); everything else folds into one line
    const bursts = new Set([...clusters].filter((c) => c.length > 1).sort((a, b) => b.length - a.length).slice(0, 2));
    const rest = clusters.filter((c) => !bursts.has(c)).flat().sort((a, b) => a.ts - b.ts);
    for (const c of clusters.filter((c) => bursts.has(c))) {
      lines.push({ ts: c[0].ts, text: `${c.length} crew wallets bought in the same second`, tx: c[0].tx, order: 2 });
    }
    if (rest.length) {
      const span = rest[rest.length - 1].ts - rest[0].ts;
      const more = bursts.size ? " more" : "";
      lines.push({
        ts: rest[0].ts,
        text: rest.length === 1 ? `A${more ? "nother" : ""} crew wallet bought` : `${rest.length}${more} crew wallets bought${span > 0 ? ` within ${dur(span)}` : ""}`,
        tx: rest[0].tx,
        order: 2,
      });
    }
  }

  // early buyers before the post
  const early = (card.early ?? []).map(firstBuy).filter((t): t is Trade => !!t && (posted === undefined || t.ts <= posted)).sort((a, b) => a.ts - b.ts);
  if (early.length) {
    lines.push({
      ts: early[0].ts,
      text: `${early.length} early ${plural(early.length, "buyer", "buyers")} got in before the post`,
      tx: early[0].tx,
      order: 3,
    });
  }

  // the post
  if (posted !== undefined) {
    const boughtBefore = insiders.some((m) => m.trades.some((t) => t.side === "buy" && t.ts < posted));
    lines.push({
      ts: posted,
      text: "The post went up",
      tone: "accent",
      note: boughtBefore ? "Anyone buying from here was buying from them." : undefined,
      order: 4,
    });
  }

  // selling
  // Only sells that come after that wallet's own first buy in view, so the story never sells before it buys.
  const sells = insiders
    .flatMap((m) => {
      const firstBuy = Math.min(...m.trades.filter((t) => t.side === "buy").map((t) => t.ts));
      return m.trades.filter((t) => t.side === "sell" && t.ts >= firstBuy);
    })
    .sort((a, b) => a.ts - b.ts);
  if (sells[0]) lines.push({ ts: sells[0].ts, text: `${group} started selling`, tx: sells[0].tx, tone: "sell", order: 5 });
  if (stance === "out" && holding.length === 0 && sells.length > 1) {
    const last = sells[sells.length - 1];
    lines.push({ ts: last.ts, text: `${group} fully out`, tx: last.tx, tone: "sell", order: 6 });
  }

  lines.sort((a, b) => a.ts - b.ts || a.order - b.order);
  const anchor = posted ?? lines[0]?.ts;

  if (!lines.length) {
    return <p className="border-y border-line-2 py-6 text-[15px] text-ink-2">No trades from wallets we can tie to this caller around this call.</p>;
  }

  return (
    <ol className="relative border-y border-line-2">
      {lines.map((l, i) => {
        const off = anchor !== undefined ? l.ts - anchor : 0;
        const rel =
          anchor === undefined || l.ts === anchor
            ? posted !== undefined
              ? "at the post"
              : "first trade"
            : `${dur(off)} ${off < 0 ? "before" : "after"} ${posted !== undefined ? "the post" : "the first trade"}`;
        const dot = l.tone === "accent" ? "bg-accent" : l.tone === "sell" ? "bg-accent" : "bg-ink";
        const textCls = l.tone === "accent" ? "text-accent" : "text-ink";
        const body = (
          <>
            <span className="font-mono text-[12px] tabular-nums text-ink-2 sm:w-[270px] sm:shrink-0">
              {clock(l.ts)} UTC <span className="text-ink-3">· {rel}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[17px] font-medium leading-snug sm:text-[19px] ${textCls}`}>
                {l.text}
                {l.tone === "sell" && <span className="sr-only"> (sell)</span>}
              </span>
              {l.note && <span className="mt-1 block text-[14px] text-ink-2">{l.note}</span>}
            </span>
            {l.tx && (
              <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 transition-colors group-hover:text-ink sm:inline" aria-hidden>
                Tx ↗
              </span>
            )}
          </>
        );
        return (
          <li key={`${l.order}-${l.ts}-${i}`} className={`relative ${i ? "border-t border-line" : ""}`}>
            <span className={`absolute left-0 top-[22px] h-2 w-2 rounded-full ${dot}`} aria-hidden />
            {l.tx ? (
              <a href={txUrl(chain, l.tx)} target="_blank" rel="noreferrer" className="group flex flex-col gap-1 py-4 pl-6 sm:flex-row sm:items-baseline sm:gap-6" aria-label={`${l.text}, ${clock(l.ts)} UTC, ${rel}. Open transaction`}>
                {body}
              </a>
            ) : (
              <div className="flex flex-col gap-1 py-4 pl-6 sm:flex-row sm:items-baseline sm:gap-6">{body}</div>
            )}
          </li>
        );
      })}
      {holding.length > 0 && (
        <li className="relative border-t border-line">
          <span className="absolute left-0 top-[22px] h-2 w-2 rounded-full border border-ink" aria-hidden />
          <div className="flex flex-col gap-1 py-4 pl-6 sm:flex-row sm:items-baseline sm:gap-6">
            <span className="font-mono text-[12px] text-ink-2 sm:w-[270px] sm:shrink-0">Now</span>
            <span className="text-[17px] font-medium leading-snug text-ink sm:text-[19px]">
              Still holding: {holding.length} {plural(holding.length, "wallet", "wallets")}
            </span>
          </div>
        </li>
      )}
    </ol>
  );
}
