"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useSolanaWallet } from "@/lib/wallet/solana";
import { getExits } from "@/lib/ui/api";
import { short } from "@/lib/ui/format";
import ExitRow from "./ExitRow";
import WalletMenu from "./WalletMenu";

function OwnerExits({ owner, label }: { owner: string; label: string }) {
  const q = useQuery({ queryKey: ["exits", owner], queryFn: () => getExits(owner), refetchInterval: 10_000 });
  return (
    <section className="mt-10">
      <h2 className="flex items-baseline gap-3 font-display text-[13px] font-semibold uppercase tracking-[0.2em] text-ink-2">
        {label} <span className="font-mono text-[12px] normal-case tracking-normal text-ink-3">{short(owner, 6, 4)}</span>
      </h2>
      {q.isPending ? (
        <p className="mt-4 text-[14px] text-ink-3">Loading your exits…</p>
      ) : q.isError ? (
        <p className="mt-4 text-[14px] text-red-ink" role="alert">
          {q.error instanceof Error ? q.error.message : "Could not load exits."}{" "}
          <button className="underline underline-offset-2" onClick={() => q.refetch()}>
            Retry
          </button>
        </p>
      ) : q.data.length === 0 ? (
        <p className="mt-4 text-[14px] text-ink-2">No exits armed from this wallet yet. Check a call and press Ride.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {[...q.data]
            .sort((a, b) => b.armedAt - a.armedAt)
            .map((x) => (
              <ExitRow key={x.id} x={x} onChange={() => q.refetch()} />
            ))}
        </ul>
      )}
    </section>
  );
}

export default function MyExits() {
  const evm = useAccount();
  const sol = useSolanaWallet();
  const none = !evm.address && !sol.publicKey;
  return (
    <div>
      {none ? (
        <div className="mt-10 max-w-xl">
          <p className="text-[14px] text-ink-2">Connect the wallet you ride with to see its armed exits and receipts.</p>
          <div className="mt-5">
            <WalletMenu />
          </div>
        </div>
      ) : (
        <>
          {evm.address && <OwnerExits owner={evm.address} label="Base" />}
          {sol.publicKey && <OwnerExits owner={sol.publicKey} label="Solana" />}
        </>
      )}
    </div>
  );
}
