"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import WalletMenu from "./WalletMenu";

const LINKS = [
  { href: "/check", label: "Check" },
  { href: "/proof", label: "Proof" },
  { href: "/exits", label: "My exits" },
  { href: "/stake", label: "Stake" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md hairline-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label="Wingman home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="ml-6 hidden items-center gap-7 md:flex" aria-label="Main">
          {LINKS.map((l) => {
            const on = path?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`link py-1 font-mono text-[11px] uppercase tracking-[0.16em] ${on ? "text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center">
          <WalletMenu compact />
        </div>
      </div>
      <nav className="flex gap-5 overflow-x-auto px-4 pb-2.5 md:hidden" aria-label="Main mobile">
        {LINKS.map((l) => {
          const on = path?.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? "page" : undefined}
              className={`shrink-0 py-1 font-mono text-[11px] uppercase tracking-[0.16em] ${on ? "text-ink underline decoration-accent decoration-2 underline-offset-[6px]" : "text-ink-3"}`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
