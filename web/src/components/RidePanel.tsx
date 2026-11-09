"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import type { ArmedExit, Card } from "@/lib/types";
import { useSolanaWallet } from "@/lib/wallet/solana";
import { rideBase, rideSolana, type RideStep } from "@/lib/ui/ride";
import { addressUrl, chainName, quoteSymbol, short } from "@/lib/ui/format";
import TierBadge from "./TierBadge";

const SLIPPAGE = [100, 300, 500, 1000];

const GROUP_TITLE = {
  Caller: "Caller wallets",
  Crew: "Crew",
  Early: "Early buyers: bought in the 3 minutes before the post",
  "Copy bot": "Copy bots: off by default",
} as const;

export interface RideOptions {
  mode: "ride" | "hold";
  /** Wallets to watch by default. Falls back to caller, crew and early buyers. */
  watch?: string[];
  /** A red line shown above the form, e.g. when part of the crew already sold. */
  warning?: string;
  /** Shown under the title, e.g. the stance from a fresh recheck. */
  status?: string;
}

export default function RidePanel({ card, open, onClose, options }: { card: Card; open: boolean; onClose: () => void; options?: RideOptions }) {
  const ref = useRef<HTMLDialogElement>(null);
  const chain = card.call.token.chain;
  const sym = quoteSymbol(chain);
  const token = card.call.token;
  const tokenName = token.symbol ? `$${token.symbol}` : short(token.address);

  const candidates = useMemo(
    () => [
      ...card.callerWallets.map((m) => ({ m, kind: "Caller" as const })),
      ...card.crew.map((m) => ({ m, kind: "Crew" as const })),
      ...(card.early ?? []).map((m) => ({ m, kind: "Early" as const })),
      ...card.copyBots.map((m) => ({ m, kind: "Copy bot" as const })),
    ],
    [card],
  );
  const defaultWatch = useMemo(
    () => options?.watch ?? [...card.callerWallets, ...card.crew, ...(card.early ?? [])].map((m) => m.wallet),
    [card, options?.watch],
  );
  const [watch, setWatch] = useState<Set<string>>(() => new Set(defaultWatch));
  const [spend, setSpend] = useState("");
  const [slip, setSlip] = useState(300);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState<ArmedExit | null>(null);
  const [mode, setMode] = useState<"ride" | "hold">("ride");
  const [step, setStep] = useState<RideStep | null>(null);
  const [awaitingExitSign, setAwaitingExitSign] = useState(false);
  const exitSignGo = useRef<(() => void) | null>(null);

  const evm = useAccount();
  const { connectors, connect } = useConnect();
  const sol = useSolanaWallet();
  const owner = chain === "base" ? evm.address : sol.publicKey;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // every time the panel opens, start from what the card asked for
  useEffect(() => {
    if (!open || busy) return;
    setMode(options?.mode ?? "ride");
    setWatch(new Set(defaultWatch));
    setError(null);
    setArmed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options, defaultWatch]);

  const spendNum = Number(spend);
  const spendValid = spend.trim() !== "" && Number.isFinite(spendNum) && spendNum > 0;
  const baseLive = Boolean(process.env.NEXT_PUBLIC_EXIT_ADDRESS);
  const canRide = !!owner && (mode === "hold" || spendValid) && watch.size > 0 && !busy && (chain === "solana" || baseLive);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!owner || !canRide) return;
    setBusy(true);
    setError(null);
    const waitForGo = () =>
      new Promise<void>((resolve) => {
        setAwaitingExitSign(true);
        exitSignGo.current = () => {
          setAwaitingExitSign(false);
          resolve();
        };
      });
    try {
      const r = chain === "base"
        ? await rideBase({ mode, token: token.address, eth: mode === "ride" ? spendNum : undefined, slippageBps: slip, watch: [...watch], cardId: card.id }, setStep, waitForGo)
        : await rideSolana(
        {
          mode,
          owner,
          mint: token.address,
          sol: mode === "ride" ? spendNum : undefined,
          slippageBps: slip,
          watch: [...watch],
          cardId: card.id,
        },
        { signAndSendTransaction: sol.signAndSendTransaction, signTransaction: sol.signTransaction },
        setStep,
        () =>
          new Promise<void>((resolve) => {
            setAwaitingExitSign(true);
            exitSignGo.current = () => {
              setAwaitingExitSign(false);
              resolve();
            };
          }),
      );
      setArmed(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while arming the exit.");
    } finally {
      setBusy(false);
      setStep(null);
      setAwaitingExitSign(false);
    }
  }

  function toggle(w: string) {
    setWatch((prev) => {
      const n = new Set(prev);
      if (n.has(w)) n.delete(w);
      else n.add(w);
      return n;
    });
  }

  const groups = (["Caller", "Crew", "Early", "Copy bot"] as const)
    .map((k) => ({ k, items: candidates.filter((c) => c.kind === k) }))
    .filter((g) => g.items.length > 0);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="ride-title"
      className="m-0 ml-auto mt-auto h-[92dvh] max-h-none w-full max-w-none overflow-hidden border-t border-line-2 bg-bg p-0 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:mt-0 sm:h-dvh sm:w-[480px] sm:border-l sm:border-t-0"
    >
      <form onSubmit={submit} className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 px-5 pb-5 pt-6 hairline-b sm:px-7">
          <div className="min-w-0">
            <p className="label text-accent-ink">Ride with an exit armed</p>
            <h2 id="ride-title" className="mt-2 truncate font-display text-[40px] leading-none">
              Ride {tokenName}
            </h2>
            <p className="mt-2 text-[13px] text-ink-3">
              {chainName(chain)} · we sell for you the moment a watched wallet sells.
            </p>
            {options?.status && <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">{options.status}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center border border-line-2 text-ink-2 transition-colors hover:border-ink hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-7">
          {armed ? (
            <div className="fade-up">
              <p className="font-display text-[44px] leading-none text-ink">Exit armed.</p>
              <p className="mt-3 text-[15px] text-ink-2">
                Watching {armed.watch.length} wallet{armed.watch.length === 1 ? "" : "s"}. The first sell from any of them fires your exit.
              </p>
              <p className="mt-1 font-mono text-[12px] text-ink-3">Status: {armed.status}</p>
              <Link href="/exits" className="group mt-6 inline-flex h-12 items-center gap-3 bg-ink px-6 font-display text-[20px] text-bg transition hover:bg-accent">
                See my exits <span className="nudge" aria-hidden>↗</span>
              </Link>
            </div>
          ) : (
            <>
              {options?.warning && mode === "ride" && (
                <p role="alert" className="border-l-2 border-accent pl-3 text-[14px] leading-relaxed text-accent-ink">
                  {options.warning}
                </p>
              )}
              <p className="text-[13px] leading-relaxed text-ink-2">
                {mode === "ride"
                  ? "The buy happens right here, from your own wallet. One wallet popup to buy, then you sign the exit. No redirect, no deposit."
                  : "Nothing is bought. You sign the exit on tokens already in your wallet."}
              </p>
              <div className="grid grid-cols-2 border border-line-2" role="tablist" aria-label="Ride mode">
                {(
                  [
                    ["ride", "Buy and arm"],
                    ["hold", "I already hold it"],
                  ] as const
                ).map(([m, l]) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`h-11 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors ${mode === m ? "bg-ink text-bg" : "text-ink-3 hover:text-ink"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {mode === "ride" && (
                <section>
                  <label htmlFor="spend" className="label">
                    You spend
                  </label>
                  <div className="mt-2 flex items-center border-b border-line-2 transition-colors focus-within:border-ink">
                    <input
                      id="spend"
                      inputMode="decimal"
                      value={spend}
                      onChange={(e) => setSpend(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0.0"
                      className="h-16 min-w-0 flex-1 bg-transparent font-display text-[44px] leading-none tabular-nums text-ink placeholder:text-ink-3 focus:outline-none"
                    />
                    <span className="font-mono text-[14px] text-ink-2">{sym}</span>
                  </div>
                </section>
              )}

              <section>
                <p className="label" id="slip-label">
                  Max slippage
                </p>
                <div className="mt-3 grid grid-cols-4 border border-line-2" role="radiogroup" aria-labelledby="slip-label">
                  {SLIPPAGE.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={slip === s}
                      onClick={() => setSlip(s)}
                      className={`h-10 font-mono text-[13px] tabular-nums transition-colors ${i ? "border-l border-line-2" : ""} ${slip === s ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}
                    >
                      {s / 100}%
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-ink-3">Used for the buy and the exit. Fast exits on thin pools may need more.</p>
              </section>

              <section>
                <div className="flex items-baseline justify-between">
                  <p className="label">Watched wallets</p>
                  <p className="font-mono text-[12px] text-ink-3">{watch.size} selected</p>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-3">Your exit fires when any watched wallet sells this token in a real swap. Transfers do not count.</p>
                {candidates.length === 0 ? (
                  <p className="mt-3 text-[13px] text-ink-2">No known wallets for this caller yet, so there is nothing to watch. Riding without a trigger is not offered.</p>
                ) : (
                  groups.map((g) => (
                    <div key={g.k} className="mt-5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-2">{GROUP_TITLE[g.k]}</p>
                      <ul className="mt-1 divide-y divide-[var(--line)] border-y border-line">
                        {g.items.map(({ m }) => (
                          <li key={m.wallet}>
                            <label className="flex cursor-pointer items-center gap-3 py-2.5">
                              <input type="checkbox" checked={watch.has(m.wallet)} onChange={() => toggle(m.wallet)} className="h-4 w-4 accent-[var(--accent)]" />
                              <TierBadge tier={m.tier} />
                              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{short(m.wallet, 5, 4)}</span>
                              <a href={addressUrl(chain, m.wallet)} target="_blank" rel="noreferrer" className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink">
                                View
                              </a>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </section>

              <section className="border-y border-line-2 py-5">
                <p className="label flex items-center gap-2 text-accent-ink">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="4" y="10" width="16" height="11" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  The permission you grant
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink">
                  {chain === "solana"
                    ? "Wingman can send one exit you sign now: it sells this one token to SOL into your own wallet. It cannot withdraw or touch anything else."
                    : "Wingman can sell this one token to USDC and send the proceeds only to you. It cannot withdraw or touch anything else."}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
                  {chain === "base"
                    ? "You approve exactly this position to the Wingman contract. Only Wingman's keeper can call fire, the USDC always goes to you, and the sale has a floor at 50% of the quote when you arm."
                    : "You presign the exit sale now with a fixed minimum out set when you arm. Wingman's keeper holds it and sends it only when a watched wallet sells this token."}{" "}
                  You can cancel any time.
                </p>
              </section>

              <section className="text-[12px] leading-relaxed text-ink-3">
                <p>
                  Exit fee: 0.5% of the exit. Free for wallets staking 100,000 $VIBES.{" "}
                  <Link href="/stake" className="link text-ink-2 hover:text-ink">
                    Stake
                  </Link>
                </p>
              </section>

              {error && (
                <p role="alert" className="border-l-2 border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2 text-[13px] text-accent-ink">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {!armed && (
          <div className="px-5 py-4 hairline-t sm:px-7">
            {busy && step && (
              <ol className="mb-4 space-y-2 font-mono text-[12px]" aria-live="polite">
                {(
                  [
                    ["buy", mode === "ride" ? "Buying in your wallet" : "Setting up in your wallet"],
                    ["locking", "Locking in your exit"],
                    ["sign_exit", "Signing your exit"],
                    ["saving", "Arming"],
                  ] as const
                ).map(([k, l], i, arr) => {
                  const cur = arr.findIndex(([kk]) => kk === step);
                  return (
                    <li key={k} className={`flex items-center gap-3 ${i === cur ? "text-ink" : i < cur ? "text-ink-2" : "text-ink-3"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${i === cur ? "pulse-dot bg-accent" : i < cur ? "bg-ink" : "bg-line-2"}`} aria-hidden />
                      {l}
                    </li>
                  );
                })}
              </ol>
            )}
            {awaitingExitSign ? (
              <div className="fade-up">
                <p className="text-[13px] leading-relaxed text-ink">
                  {chain === "base"
                    ? "You're arming your exit now. Nothing is sold yet. When a watched wallet sells this token, Wingman sells your position to USDC into your own wallet, never below your floor."
                    : "You're signing your exit now. It is held, not sent. Wingman sends it only when a watched wallet sells this token. It sells this one token to SOL into your own wallet."}
                </p>
                <button
                  type="button"
                  onClick={() => exitSignGo.current?.()}
                  className="mt-3 h-12 w-full bg-accent font-display text-[20px] text-on-accent transition hover:brightness-110"
                >
                  Sign my exit
                </button>
              </div>
            ) : chain === "base" && !baseLive ? (
              <p className="border border-line-2 px-4 py-3 text-center text-[13px] text-ink-2">Base exits go live with the contract deploy.</p>
            ) : owner ? (
              <button
                type="submit"
                disabled={!canRide}
                className="h-12 w-full bg-accent font-display text-[20px] text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-bg-3 disabled:text-ink-3"
              >
                {busy ? "Waiting…" : mode === "hold" ? "Arm exit on my tokens" : spendValid ? `Buy ${spend} ${sym} and arm exit` : "Enter an amount"}
              </button>
            ) : chain === "base" ? (
              <div className="flex gap-2">
                {connectors.map((c) => (
                  <button
                    key={c.uid}
                    type="button"
                    onClick={() => connect({ connector: c })}
                    className="h-12 flex-1 bg-ink px-3 font-display text-[18px] text-bg transition hover:bg-accent"
                  >
                    {c.name === "Injected" ? "Connect wallet" : c.name}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => sol.connect()} className="h-12 w-full bg-ink font-display text-[20px] text-bg transition hover:bg-accent">
                {sol.available ? "Connect Phantom" : "Install Phantom to ride on Solana"}
              </button>
            )}
            <p className="mt-2 text-center font-mono text-[11px] text-ink-3">
              {owner ? `Riding from ${short(owner, 5, 4)} on ${chainName(chain)}` : `Connect a ${chainName(chain)} wallet to ride`}
            </p>
          </div>
        )}
      </form>
    </dialog>
  );
}
