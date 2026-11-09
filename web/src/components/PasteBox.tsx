"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PasteBox({ initial = "", autoFocus = false, size = "lg" }: { initial?: string; autoFocus?: boolean; size?: "lg" | "md" }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [hint, setHint] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) {
      setHint("Paste an X post, a Farcaster cast, a Telegram channel post, or a token address first.");
      return;
    }
    if (/^@?[A-Za-z0-9_]{1,15}$/.test(q)) {
      setHint("A handle on its own is not enough. Paste one of their posts, or a token address with the @handle next to it.");
      return;
    }
    setHint(null);
    router.push(`/check?q=${encodeURIComponent(q)}`);
  }

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setValue(t.trim());
    } catch {
      setHint("Your browser blocked clipboard access. Paste with Ctrl+V or a long press.");
    }
  }

  const big = size === "lg";
  return (
    <form onSubmit={submit} className="w-full" role="search" aria-label="Check a call">
      <div
        className={`group relative flex w-full items-center gap-2 border bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur-sm transition-colors focus-within:border-ink ${
          hint ? "border-accent" : "border-line-2 hover:border-[color-mix(in_srgb,var(--ink)_40%,transparent)]"
        } ${big ? "p-1.5" : "p-1"}`}
      >
        <span className="pointer-events-none pl-3 font-mono text-[13px] text-accent-ink" aria-hidden>
          &gt;
        </span>
        <label htmlFor="call-input" className="sr-only">
          X post, Farcaster cast, Telegram channel post, or token address with an optional @handle
        </label>
        <input
          id="call-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (hint) setHint(null);
          }}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          placeholder="X, t.me, cast or token"
          className={`min-w-0 flex-1 bg-transparent font-mono text-ink placeholder:text-ink-3 focus:outline-none ${big ? "h-12 text-[14px] sm:text-[15px]" : "h-10 text-[13px]"}`}
        />
        {!value && (
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="hidden shrink-0 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-ink sm:block"
          >
            Paste
          </button>
        )}
        <button
          type="submit"
          className={`group/btn inline-flex shrink-0 items-center gap-2 bg-accent font-display text-on-accent transition-[filter,transform] hover:brightness-110 active:scale-[0.98] ${
            big ? "h-12 px-5 text-[18px] sm:px-7 sm:text-[20px]" : "h-10 px-4 text-[16px]"
          }`}
        >
          Check
          <span aria-hidden className="transition-transform group-hover/btn:translate-x-0.5">
            →
          </span>
        </button>
      </div>
      {hint && (
        <p className="mt-2 text-[13px] text-accent-ink" role="alert">
          {hint}
        </p>
      )}
    </form>
  );
}
