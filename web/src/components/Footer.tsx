import Link from "next/link";
import Logo from "./Logo";

const COLS = [
  {
    title: "Product",
    links: [
      { href: "/check", label: "Check a call" },
      { href: "/exits", label: "My exits" },
      { href: "/stake", label: "Stake $VIBES" },
      { href: "/proof", label: "Proof" },
      { href: "https://t.me/wingmancheckerbot", label: "Telegram bot" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#ride", label: "The exit permission" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden hairline-t">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr_1fr] lg:px-10">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-ink-2">
            Wingman reads public onchain trades on Solana and Base and sells for you the moment a watched crew wallet sells.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="label">{c.title}</p>
            <ul className="mt-5 space-y-3 text-[14px]">
              {c.links.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith("http") ? (
                    <a className="link text-ink-2 hover:text-ink" href={l.href} target="_blank" rel="noreferrer">
                      {l.label} ↗
                    </a>
                  ) : (
                    <Link className="link text-ink-2 hover:text-ink" href={l.href}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="label">Chains</p>
          <ul className="mt-5 space-y-3 text-[14px] text-ink-2">
            <li>Solana</li>
            <li>Base</li>
          </ul>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none select-none px-4 sm:px-6 lg:px-10">
        <p className="mx-auto max-w-7xl font-display text-[23vw] leading-[0.78] tracking-[-0.01em] text-[color-mix(in_srgb,var(--ink)_7%,transparent)] lg:text-[17rem]">
          Wingman
        </p>
      </div>

      <div className="hairline-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-[12px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p>Built for Vibestarter Vibeathon 02.</p>
          <p>Not financial advice. Onchain data can be incomplete; every claim links to its transaction.</p>
        </div>
      </div>
    </footer>
  );
}
