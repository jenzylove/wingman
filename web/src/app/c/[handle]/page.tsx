import type { Metadata } from "next";
import Link from "next/link";
import TierBadge from "@/components/TierBadge";
import { loadCaller } from "@/lib/ui/server";
import { addressUrl, dateTimeUtc, short } from "@/lib/ui/format";
import type { Chain } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${decodeURIComponent(handle).replace(/^@/, "")}`, description: "Known wallets and recent calls for this caller." };
}

function guessChain(addr: string): Chain {
  return addr.startsWith("0x") ? "base" : "solana";
}

export default async function CallerPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw).replace(/^@/, "");
  const r = await loadCaller(handle);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-10">
      <p className="label text-accent-ink">Caller</p>
      <h1 className="mt-4 break-all font-display text-[56px] leading-[0.9] sm:text-[104px]">@{handle}</h1>
      <a href={`https://x.com/${encodeURIComponent(handle)}`} target="_blank" rel="noreferrer" className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink">
        Open on X ↗
      </a>

      {!r.ok ? (
        <div className="mt-12 max-w-2xl" role="alert">
          <p className="label text-accent-ink">{r.status === 404 ? "No data yet" : "Could not load this caller"}</p>
          <p className="mt-4 font-display text-[32px] leading-[0.95] sm:text-[44px]">
            {r.status === 404 ? "We have not looked at this caller yet. Check one of their calls to start." : r.error}
          </p>
          <Link href="/check" className="mt-8 inline-flex h-12 items-center bg-accent px-6 font-display text-[20px] text-on-accent transition hover:brightness-110">
            Check a call
          </Link>
        </div>
      ) : (
        <div className="mt-12 grid gap-16 lg:grid-cols-[1.3fr_1fr]">
          <section aria-labelledby="w-title">
            <h2 id="w-title" className="font-display text-[32px] leading-none text-ink">
              Known wallets
            </h2>
            {r.data.wallets.length === 0 ? (
              <p className="mt-4 text-[14px] text-ink-2">No known wallets for this caller yet. Coverage 0%.</p>
            ) : (
              <ul className="mt-5 divide-y divide-[var(--line)] border-y border-line-2">
                {r.data.wallets.map((w) => {
                  const chain = w.trades[0] ? (w.trades[0].quoteSymbol === "SOL" ? "solana" : "base") : guessChain(w.wallet);
                  return (
                    <li key={w.wallet} className="py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <TierBadge tier={w.tier} />
                        <a href={addressUrl(chain, w.wallet)} target="_blank" rel="noreferrer" className="link font-mono text-[14px] text-ink">
                          {short(w.wallet, 6, 6)}
                        </a>
                        {w.repeat && (
                          <span className="text-[12px] text-ink-3">
                            {w.repeat.hits} of {w.repeat.of} calls
                          </span>
                        )}
                        {w.proofUrl && (
                          <a href={w.proofUrl} target="_blank" rel="noreferrer" className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink">
                            Proof ↗
                          </a>
                        )}
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{w.evidence}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section aria-labelledby="r-title">
            <h2 id="r-title" className="font-display text-[32px] leading-none text-ink">
              Recent calls
            </h2>
            {r.data.recent.length === 0 ? (
              <p className="mt-4 text-[14px] text-ink-2">No recent calls checked yet.</p>
            ) : (
              <ul className="mt-5 divide-y divide-[var(--line)] border-y border-line-2">
                {r.data.recent.map((c) => (
                  <li key={c.token + c.ts}>
                    <Link href={`/check?q=${encodeURIComponent(c.token)}`} className="group flex items-center gap-4 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[14px] text-ink transition-colors group-hover:text-accent-ink">{short(c.token, 6, 6)}</p>
                        <p className="mt-0.5 text-[12px] text-ink-3">{dateTimeUtc(c.ts)}</p>
                      </div>
                      <p className={`shrink-0 font-display text-[18px] ${c.crewHits > 0 ? "text-accent" : "text-ink-3"}`}>
                        {c.crewHits} crew {c.crewHits === 1 ? "wallet" : "wallets"} early
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
