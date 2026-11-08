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

export default function RidePanel({ card, open, onClose }: { card: Card; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const chain = card.call.token.chain;
  const sym = quoteSymbol(chain);
  const token = card.call.token;
  const tokenName = token.symbol ? `$${token.symbol}` : short(token.address);

  const candidates = useMemo(
    () => [
      ...card.callerWallets.map((m) => ({ m, kind: "Caller" })),
      ...card.crew.map((m) => ({ m, kind: "Crew" })),
      ...card.copyBots.map((m) => ({ m, kind: "Copy bot" })),
    ],
    [card],
  );
  const [watch, setWatch] = useState<Set<string>>(
    () => new Set([...card.callerWallets, ...card.crew].map((m) => m.wallet)),
  );
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

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="ride-title"
      className="m-0 ml-auto mt-auto h-[92dvh] max-h-none w-full max-w-none overflow-hidden rounded-t-2xl bg-bg p-0 text-ink shadow-2xl ring-1 ring-line-2 backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:mt-0 sm:h-dvh sm:w-[460px] sm:rounded-none sm:rounded-l-2xl"
    >
      <form onSubmit={submit} className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 hairline-b sm:px-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-green-ink">Ride with an exit armed</p>
            <h2 id="ride-title" className="mt-1 font-display text-[22px] font-semibold">
              Ride {tokenName}
            </h2>
            <p className="mt-1 text-[12px] text-ink-3">
              {chainName(chain)} · we sell for you the moment a watched wallet sells.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-bg-3 hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-6">
          {armed ? (
            <div className="fade-up">
              <p className="font-display text-[20px] text-green-ink">Exit armed.</p>
              <p className="mt-2 text-[14px] text-ink-2">
                Watching {armed.watch.length} wallet{armed.watch.length === 1 ? "" : "s"}. The first sell from any of them triggers your exit.
              </p>
              <p className="mt-1 text-[12px] text-ink-3">Status: {armed.status}</p>
              <Link href="/exits" className="mt-5 inline-flex h-11 items-center rounded-xl bg-green px-5 font-display text-[13px] font-semibold text-on-accent">
                See my exits
              </Link>
            </div>
          ) : (
            <>
              {(
                <div className="flex gap-1 rounded-xl bg-bg-2 p-1" role="tablist" aria-label="Ride mode">
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
                      className={`h-10 flex-1 rounded-lg text-[13px] ${mode === m ? "bg-bg-3 text-ink" : "text-ink-3 hover:text-ink"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
              {mode === "ride" && (
              <section>
                <label htmlFor="spend" className="text-[11px] uppercase tracking-[0.18em] text-ink-3">
                  You spend
                </label>
                <div className="mt-2 flex items-center rounded-xl bg-bg-2 ring-1 ring-line-2 focus-within:ring-2 focus-within:ring-green">
                  <input
                    id="spend"
                    inputMode="decimal"
                    value={spend}
                    onChange={(e) => setSpend(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.0"
                    className="h-14 min-w-0 flex-1 bg-transparent px-4 font-display text-[22px] tabular-nums text-ink placeholder:text-ink-3 focus:outline-none"
                  />
                  <span className="pr-4 text-[14px] text-ink-2">{sym}</span>
                </div>
              </section>
              )}

              <section>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3" id="slip-label">
                  Max slippage
                </p>
                <div className="mt-2 flex gap-2" role="radiogroup" aria-labelledby="slip-label">
                  {SLIPPAGE.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={slip === s}
                      onClick={() => setSlip(s)}
                      className={`h-10 flex-1 rounded-lg text-[13px] tabular-nums transition ${slip === s ? "bg-ink text-bg" : "bg-bg-2 text-ink-2 hover:text-ink"}`}
                    >
                      {s / 100}%
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-ink-3">Used for both the buy and the exit. Fast exits on thin pools may need more.</p>
              </section>

              <section>
                <div className="flex items-baseline justify-between">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Watched wallets</p>
                  <p className="text-[12px] text-ink-3">{watch.size} selected</p>
                </div>
                {candidates.length === 0 ? (
                  <p className="mt-3 text-[13px] text-ink-2">No known wallets for this caller yet, so there is nothing to watch. Riding without a trigger is not offered.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-[var(--line)]">
                    {candidates.map(({ m, kind }) => (
                      <li key={m.wallet}>
                        <label className="flex cursor-pointer items-center gap-3 py-2.5">
                          <input type="checkbox" checked={watch.has(m.wallet)} onChange={() => toggle(m.wallet)} className="h-4 w-4 accent-[var(--green)]" />
                          <TierBadge tier={m.tier} />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{short(m.wallet, 5, 4)}</span>
                          <span className="text-[11px] text-ink-3">{kind}</span>
                          <a href={addressUrl(chain, m.wallet)} target="_blank" rel="noreferrer" className="text-[11px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">
                            View
                          </a>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl bg-bg-2 p-4">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-green-ink">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  The permission you grant
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink">
                  {chain === "solana"
                    ? "Wingman can send one exit you sign now: it sells this one token to SOL into your own wallet. It cannot withdraw or touch anything else."
                    : "Wingman can sell this one token to USDC and send the proceeds only to you. It cannot withdraw or touch anything else."}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
                  {chain === "base"
                    ? "On Base you approve exactly this position to the Wingman contract, with a USDC floor the sale can never go below. Its code only sells and only pays you."
                    : "On Solana you sign the exit sale ahead of time. Wingman holds it and sends it only when a watched wallet sells this token."}{" "}
                  You can cancel it at any time from My exits.
                </p>
              </section>

              <section className="text-[12px] leading-relaxed text-ink-3">
                <p>
                  Exit fee: 0.5% of the exit. Free for wallets staking 100,000+ $VIBES.{" "}
                  <Link href="/stake" className="text-ink-2 underline underline-offset-2 hover:text-ink">
                    Stake
                  </Link>
                </p>
              </section>

              {error && (
                <p role="alert" className="rounded-lg bg-[color-mix(in_srgb,var(--red)_12%,transparent)] px-3 py-2 text-[13px] text-red-ink">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {!armed && (
          <div className="px-5 py-4 hairline-t sm:px-6">
            {busy && step && (
              <ol className="mb-4 space-y-2 text-[13px]" aria-live="polite">
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
                      <span className={`h-1.5 w-1.5 rounded-full ${i === cur ? "pulse-dot bg-green" : i < cur ? "bg-green" : "bg-line-2"}`} aria-hidden />
                      {l}
                    </li>
                  );
                })}
              </ol>
            )}
            {awaitingExitSign ? (
              <div className="fade-up">
                <p className="text-[13px] leading-relaxed text-ink">
                  {chain === "base" ? "You're arming your exit now. Nothing is sold yet. When a watched wallet sells this token, Wingman sells your position to USDC into your own wallet, never below your floor." : "You're signing your exit now. It is held, not sent. Wingman sends it only when a watched wallet sells this token. It sells this one token to SOL into your own wallet."}
                </p>
                <button
                  type="button"
                  onClick={() => exitSignGo.current?.()}
                  className="mt-3 h-12 w-full rounded-xl bg-green font-display text-[14px] font-semibold text-on-accent transition hover:brightness-110"
                >
                  Sign my exit
                </button>
              </div>
            ) : chain === "base" && !baseLive ? (
              <p className="rounded-xl bg-bg-2 px-4 py-3 text-center text-[13px] text-ink-2">Base exits go live with the contract deploy.</p>
            ) : owner ? (
              <button
                type="submit"
                disabled={!canRide}
                className="h-12 w-full rounded-xl bg-green font-display text-[14px] font-semibold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
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
                    className="h-12 flex-1 rounded-xl bg-ink px-3 font-display text-[13px] font-semibold text-bg"
                  >
                    {c.name === "Injected" ? "Connect wallet" : c.name}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => sol.connect()} className="h-12 w-full rounded-xl bg-ink font-display text-[14px] font-semibold text-bg">
                {sol.available ? "Connect Phantom" : "Install Phantom to ride on Solana"}
              </button>
            )}
            <p className="mt-2 text-center text-[11px] text-ink-3">
              {owner ? `Riding from ${short(owner, 5, 4)} on ${chainName(chain)}` : `Connect a ${chainName(chain)} wallet to ride`}
            </p>
          </div>
        )}
      </form>
    </dialog>
  );
}
