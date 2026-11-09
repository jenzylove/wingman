"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/types";
import { postCard } from "@/lib/ui/api";
import CardView from "./CardView";
import PasteBox from "./PasteBox";
import Constellation from "./Constellation";

/** Rough time each stage tends to start. Used only to say what is probably happening now. */
const STAGES = [
  { at: 0, label: "Reading the post" },
  { at: 3, label: "Finding the caller's wallets" },
  { at: 7, label: "Pulling trades around the post" },
  { at: 13, label: "Finding the crew" },
  { at: 19, label: "Scoring" },
];

type State = { kind: "loading" } | { kind: "done"; card: Card } | { kind: "error"; message: string };

export default function CheckRunner({ q }: { q: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (!q) return;
    const c = new AbortController();
    ctrl.current = c;
    setState({ kind: "loading" });
    setElapsed(0);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - t0) / 1000), 200);
    postCard(q, c.signal)
      .then((card) => {
        setState({ kind: "done", card });
        try {
          window.history.replaceState(null, "", `/card/${encodeURIComponent(card.id)}`);
        } catch {
          // fine, the share button still gives the card link
        }
      })
      .catch((e: unknown) => {
        if (c.signal.aborted) return;
        const msg =
          e instanceof TypeError
            ? "Could not reach the Wingman API. Check your connection and try again."
            : e instanceof Error
              ? e.message
              : "Something went wrong.";
        setState({ kind: "error", message: msg });
      })
      .finally(() => clearInterval(timer));
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [q, attempt]);

  if (!q) {
    return (
      <div className="max-w-3xl py-10 sm:py-16">
        <p className="label text-accent-ink">Check</p>
        <h1 className="mt-4 font-display text-[64px] leading-[0.88] sm:text-[104px]">Check a call</h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">
          Paste an X post link, a Farcaster cast, a public Telegram channel post, or a token address. Add the caller&apos;s @handle next to a token address to check that caller. Or forward the call to{" "}
          <a href="https://t.me/wingmancheckerbot" target="_blank" rel="noreferrer" className="link text-ink">
            @wingmancheckerbot
          </a>{" "}
          on Telegram.
        </p>
        <div className="mt-10">
          <PasteBox autoFocus />
        </div>
      </div>
    );
  }

  if (state.kind === "done") return <CardView card={state.card} />;

  if (state.kind === "error") {
    return (
      <div className="mx-auto max-w-2xl py-16 fade-up" role="alert">
        <p className="label text-accent-ink">Could not build the card</p>
        <h1 className="mt-4 font-display text-[36px] leading-[0.95] sm:text-[52px]">{state.message}</h1>
        <p className="mt-4 break-all font-mono text-[12px] text-ink-3">You checked: {q}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <button type="button" onClick={run} className="h-12 bg-ink px-6 font-display text-[20px] text-bg transition hover:bg-accent">
            Try again
          </button>
        </div>
        <div className="mt-10">
          <p className="mb-3 text-[12px] text-ink-3">Or check something else</p>
          <PasteBox initial={q} size="md" />
        </div>
      </div>
    );
  }

  // loading: stage shown is an estimate from elapsed time, never marked done
  let current = 0;
  STAGES.forEach((s, i) => {
    if (elapsed >= s.at) current = i;
  });
  const slow = elapsed > 35;

  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-14" aria-busy="true">
      <div className="relative -mx-4 h-[180px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,black_40%,transparent_85%)] sm:mx-0 sm:h-[220px]" aria-hidden>
        <Constellation focusX={0.5} focusY={0.5} mobileFocusX={0.5} mobileFocusY={0.5} density={0.55} crewCount={5} seed={11} />
      </div>
      <p className="label mt-4 flex items-center gap-2.5 text-ink-2">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        Working
      </p>
      <h1 className="mt-3 break-all font-mono text-[15px] leading-snug text-ink sm:text-[17px]">{q}</h1>
      <div className="mt-6 h-px w-full overflow-hidden bg-line">
        <div className="scan-bar h-px w-full" />
      </div>
      <ol className="mt-8 space-y-4" aria-live="polite">
        {STAGES.map((s, i) => {
          const active = i === current;
          const ahead = i > current;
          return (
            <li key={s.label} className={`flex items-center gap-4 text-[14px] transition ${ahead ? "text-ink-3" : active ? "text-ink" : "text-ink-2"}`}>
              <span className="grid w-5 place-items-center" aria-hidden>
                {active ? (
                  <span className="pulse-dot h-2 w-2 rounded-full bg-accent" />
                ) : ahead ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-line-2" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />
                )}
              </span>
              <span>{s.label}</span>
              {active && <span className="text-[12px] text-ink-3">probably now</span>}
            </li>
          );
        })}
      </ol>
      <div className="mt-10 flex items-center justify-between gap-4 hairline-t pt-4 text-[12px] text-ink-3">
        <p>
          <span className="tabular-nums text-ink-2">{elapsed.toFixed(0)}s</span> elapsed. Usually 5 to 25 seconds. Steps are estimated from time; nothing is final until the card arrives.
        </p>
        <button
          type="button"
          onClick={() => {
            ctrl.current?.abort();
            setState({ kind: "error", message: "You stopped this check." });
          }}
          className="shrink-0 border border-line-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 transition-colors hover:border-ink hover:text-ink"
        >
          Stop
        </button>
      </div>
      {slow && <p className="mt-4 text-[13px] text-ink">This is taking longer than usual. Busy tokens have more trades to read.</p>}
    </div>
  );
}
