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
      setHint("Paste an X post link, a cast, a token address or a caller handle first.");
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
      setHint("Your browser blocked clipboard access. Paste with Ctrl+V or long press.");
    }
  }

  const big = size === "lg";
  return (
    <form onSubmit={submit} className="w-full" role="search" aria-label="Check a call">
      <div
        className={`group relative flex w-full items-center gap-2 rounded-2xl bg-bg-2 ring-1 ring-line-2 transition focus-within:ring-2 focus-within:ring-amber ${
          big ? "p-2 sm:p-2.5" : "p-1.5"
        }`}
      >
        <span className="pointer-events-none pl-3 text-amber" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
            <path d="M12 12 L19 5" />
          </svg>
        </span>
        <label htmlFor="call-input" className="sr-only">
          X post link, cast, token address or caller handle
        </label>
        <input
          id="call-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste a call: x.com link, cast, token or @handle"
          className={`min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-3 focus:outline-none ${big ? "h-12 text-[15px] sm:text-[16px]" : "h-10 text-[14px]"}`}
        />
        {!value && (
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="hidden shrink-0 rounded-lg px-3 py-2 text-[12px] text-ink-3 hover:bg-bg-3 hover:text-ink sm:block"
          >
            Paste
          </button>
        )}
        <button
          type="submit"
          className={`shrink-0 rounded-xl bg-amber font-display font-semibold text-on-accent transition hover:brightness-110 active:scale-[0.98] ${
            big ? "h-12 px-5 text-[14px] sm:px-7" : "h-10 px-4 text-[13px]"
          }`}
        >
          Check
        </button>
      </div>
      {hint && (
        <p className="mt-2 text-[13px] text-red-ink" role="alert">
          {hint}
        </p>
      )}
    </form>
  );
}
