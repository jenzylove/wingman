"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useSolanaWallet } from "@/lib/wallet/solana";
import { short } from "@/lib/ui/format";

export default function WalletMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const evm = useAccount();
  const { connectors, connect, isPending, error: evmError } = useConnect();
  const { disconnect } = useDisconnect();
  const sol = useSolanaWallet();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const connected = evm.address || sol.publicKey;
  const label = evm.address ? short(evm.address) : sol.publicKey ? short(sol.publicKey) : "Connect";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition ${
          connected ? "bg-bg-3 text-ink hover:bg-bg-2" : "bg-ink text-bg hover:opacity-90"
        }`}
      >
        {connected && <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden />}
        {compact && !connected ? "Connect" : label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(88vw,300px)] rounded-xl bg-bg-2 p-2 shadow-2xl ring-1 ring-line-2"
        >
          <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-[0.18em] text-ink-3">Base</p>
          {evm.address ? (
            <div className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px]">
              <span className="text-ink">{short(evm.address, 6, 4)}</span>
              <button className="text-ink-3 hover:text-red-ink" onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>
          ) : (
            connectors.map((c) => (
              <button
                key={c.uid}
                role="menuitem"
                disabled={isPending}
                onClick={() => connect({ connector: c })}
                className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-bg-3 disabled:opacity-50"
              >
                {c.name === "Injected" ? "Browser wallet" : c.name}
              </button>
            ))
          )}
          {evmError && <p className="px-3 py-1 text-[12px] text-red-ink">{evmError.message.split("\n")[0]}</p>}

          <p className="hairline-t mt-2 px-3 pb-1 pt-3 text-[11px] uppercase tracking-[0.18em] text-ink-3">Solana</p>
          {sol.publicKey ? (
            <div className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px]">
              <span className="text-ink">{short(sol.publicKey, 6, 4)}</span>
              <button className="text-ink-3 hover:text-red-ink" onClick={() => sol.disconnect()}>
                Disconnect
              </button>
            </div>
          ) : (
            <button
              role="menuitem"
              disabled={sol.connecting}
              onClick={() => sol.connect()}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-bg-3 disabled:opacity-50"
            >
              {sol.available ? "Phantom" : "Phantom (not installed)"}
            </button>
          )}
          {sol.error && <p className="px-3 py-1 text-[12px] text-red-ink">{sol.error}</p>}
        </div>
      )}
    </div>
  );
}
