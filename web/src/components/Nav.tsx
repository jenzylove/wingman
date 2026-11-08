"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import WalletMenu from "./WalletMenu";

const LINKS = [
  { href: "/proof", label: "Proof" },
  { href: "/exits", label: "My exits" },
  { href: "/stake", label: "Stake" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-md hairline-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Wingman home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1.5 text-[13px] transition hover:text-ink ${
                path?.startsWith(l.href) ? "text-ink" : "text-ink-3"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <WalletMenu compact />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Main mobile">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-full px-3 py-1 text-[12px] ${path?.startsWith(l.href) ? "bg-bg-3 text-ink" : "text-ink-3"}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
