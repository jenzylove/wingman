"use client";

import { useState } from "react";
import type { ArmedExit } from "@/lib/types";
import { useSolanaWallet } from "@/lib/wallet/solana";
import { cancelSolana } from "@/lib/ui/ride";
import { chainName, clock, dateTimeUtc, dur, num, quoteSymbol, short, toMs, tokenUrl, txUrl, usd } from "@/lib/ui/format";

const STATUS: Record<ArmedExit["status"], { label: string; cls: string }> = {
  pending: { label: "Setting up", cls: "text-ink-3" },
  armed: { label: "Armed", cls: "text-green-ink" },
  fired: { label: "Exited", cls: "text-amber-ink" },
  cancelled: { label: "Cancelled", cls: "text-ink-3" },
  failed: { label: "Failed", cls: "text-red-ink" },
};

export function receiptText(x: ArmedExit): string | null {
  if (!x.trigger || !x.exit) return null;
  const lag = (toMs(x.exit.ts) - toMs(x.trigger.ts)) / 1000;
  const out = x.exit.usdOut !== undefined ? usd(x.exit.usdOut) : `${num(x.exit.quoteOut, 4)} ${quoteSymbol(x.chain)}`;
  return `Crew started selling ${clock(x.trigger.ts)}. I was out ${clock(x.exit.ts)}, ${dur(lag)} later, with ${out}.`;
}

export default function ExitRow({ x, showOwner = false, onChange }: { x: ArmedExit; showOwner?: boolean; onChange?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const sol = useSolanaWallet();
  const canCancel = x.chain === "solana" && x.status === "armed" && !!sol.publicKey && sol.publicKey === x.owner;

  async function cancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelSolana(x.id, x.owner, { signAndSendTransaction: sol.signAndSendTransaction, signTransaction: sol.signTransaction });
      onChange?.();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Could not cancel this exit.");
    } finally {
      setCancelling(false);
    }
  }
  const s = STATUS[x.status];
  const receipt = receiptText(x);
  const lag = x.trigger && x.exit ? (toMs(x.exit.ts) - toMs(x.trigger.ts)) / 1000 : null;

  async function copy() {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(`${receipt} Exit by Wingman.`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your receipt", receipt);
    }
  }

  return (
    <li className="grid gap-4 py-6 md:grid-cols-[150px_1fr_auto] md:items-start">
      <div>
        <p className={`flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.14em] ${s.cls}`}>
          {x.status === "armed" && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-green" aria-hidden />}
          {s.label}
        </p>
        <p className="mt-1 text-[12px] text-ink-3">{chainName(x.chain)}</p>
        {x.selfTest && <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-amber-ink">Our own test wallets</p>}
      </div>

      <div className="min-w-0">
        {receipt && x.trigger && x.exit ? (
          <div className="font-display text-[16px] leading-snug text-ink sm:text-[18px]">
            <p>
              Crew started selling <span className="tabular-nums text-red-ink">{clock(x.trigger.ts)}</span>.
            </p>
            <p>
              You were out <span className="tabular-nums text-green-ink">{clock(x.exit.ts)}</span>
              {lag !== null && <span className="text-ink-3"> ({dur(lag)} later)</span>}.
            </p>
          </div>
        ) : (
          <p className="text-[14px] text-ink-2">
            Watching {x.watch.length} wallet{x.watch.length === 1 ? "" : "s"} on{" "}
            <a href={tokenUrl(x.chain, x.token)} target="_blank" rel="noreferrer" className="text-ink hover:underline">
              {short(x.token, 5, 4)}
            </a>
            . Max slippage {x.maxSlippageBps / 100}%.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
          <span>Armed {dateTimeUtc(x.armedAt)}</span>
          {showOwner && <span>Owner {short(x.owner)}</span>}
          {x.armTx && (
            <a href={txUrl(x.chain, x.armTx)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
              Arm tx
            </a>
          )}
          {x.trigger && (
            <a href={txUrl(x.chain, x.trigger.tx)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
              Crew sell tx ({short(x.trigger.wallet)})
            </a>
          )}
          {x.exit && (
            <a href={txUrl(x.chain, x.exit.tx)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
              Your exit tx
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 md:flex-col md:items-end">
        {x.exit && (
          <p className="font-display text-[20px] font-semibold tabular-nums text-ink">
            {x.exit.usdOut !== undefined ? usd(x.exit.usdOut) : `${num(x.exit.quoteOut, 4)} ${quoteSymbol(x.chain)}`}
          </p>
        )}
        {receipt && (
          <button type="button" onClick={copy} className="h-9 rounded-lg bg-bg-3 px-3 text-[12px] text-ink hover:bg-bg-2">
            {copied ? "Receipt copied" : "Copy receipt"}
          </button>
        )}
        {canCancel && (
          <button type="button" onClick={cancel} disabled={cancelling} className="h-9 rounded-lg px-3 text-[12px] text-ink-3 ring-1 ring-line-2 hover:text-red-ink disabled:opacity-50">
            {cancelling ? "Cancelling…" : "Cancel exit"}
          </button>
        )}
        {cancelError && (
          <p className="max-w-[240px] text-[12px] text-red-ink" role="alert">
            {cancelError}
          </p>
        )}
      </div>
    </li>
  );
}
