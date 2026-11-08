"use client";

import { useEffect, useState } from "react";

type Mode = "dark" | "light";

function current(): Mode {
  if (typeof document === "undefined") return "dark";
  const set = document.documentElement.dataset.theme;
  if (set === "dark" || set === "light") return set;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => setMode(current()), []);

  function flip() {
    const next: Mode = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("wingman-theme", next);
    } catch {
      // storage blocked, theme still applies for this visit
    }
    setMode(next);
  }

  const label = mode === "light" ? "Switch to night mode" : "Switch to day mode";
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition hover:bg-bg-3 hover:text-ink"
    >
      {mode === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}

/** Inline script that sets the saved theme before first paint. */
export const themeBootScript = `try{var t=localStorage.getItem('wingman-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`;
