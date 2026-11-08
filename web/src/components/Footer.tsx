import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="hairline-t mt-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-3">
            Ride the call. Leave when they leave. Wingman reads public onchain trades on Solana and Base and sells for you
            the moment a caller&apos;s crew starts selling.
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Product</p>
          <ul className="mt-4 space-y-2 text-[13px]">
            <li><Link className="text-ink-2 hover:text-ink" href="/#check">Check a call</Link></li>
            <li><Link className="text-ink-2 hover:text-ink" href="/exits">My exits</Link></li>
            <li><Link className="text-ink-2 hover:text-ink" href="/stake">Stake $VIBES</Link></li>
            <li><Link className="text-ink-2 hover:text-ink" href="/proof">Proof</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Learn</p>
          <ul className="mt-4 space-y-2 text-[13px]">
            <li><Link className="text-ink-2 hover:text-ink" href="/#how">How it works</Link></li>
            <li><Link className="text-ink-2 hover:text-ink" href="/#ride">The exit permission</Link></li>
            <li><Link className="text-ink-2 hover:text-ink" href="/#faq">FAQ</Link></li>
            <li>
              <a className="text-ink-2 hover:text-ink" href="https://blog.bubblemaps.io/bubblemaps-investigates-crypto-kol-moves-onchain/" target="_blank" rel="noreferrer">
                Bubblemaps research
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Chains</p>
          <ul className="mt-4 space-y-2 text-[13px] text-ink-2">
            <li>Solana</li>
            <li>Base</li>
          </ul>
        </div>
      </div>
      <div className="hairline-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-[12px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Built on the night shift for Vibestarter Vibeathon 02.</p>
          <p>Not financial advice. Onchain data can be incomplete; every claim links to its transaction.</p>
        </div>
      </div>
    </footer>
  );
}
