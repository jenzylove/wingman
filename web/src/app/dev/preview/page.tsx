import { notFound } from "next/navigation";
import CardView from "@/components/CardView";
import ExitRow from "@/components/ExitRow";
import { fixtureExits, fixtureIn, fixtureNone, fixtureOut, fixtureSelling } from "@/fixtures/cards";

export const metadata = { title: "Dev preview", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATES = [
  { k: "in", card: fixtureIn },
  { k: "selling", card: fixtureSelling },
  { k: "out", card: fixtureOut },
  { k: "none", card: fixtureNone },
];

// Dev only: renders fixtures so the card can be designed without the API.
export default function DevPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  // checked two minutes ago on every render, so Ride opens without a recheck
  const checked = Math.floor(Date.now() / 1000) - 120;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-10">
      <p className="mb-6 border-l-2 border-accent px-3 py-2 font-mono text-[12px] text-ink-2">
        Dev preview with fixture data. This route does not exist in production.
      </p>
      <nav className="mb-12 flex flex-wrap gap-4 font-mono text-[12px] uppercase tracking-[0.14em]" aria-label="States">
        {STATES.map((s) => (
          <a key={s.k} href={`#state-${s.k}`} className="link text-ink-2 hover:text-ink">
            Stance: {s.k}
          </a>
        ))}
      </nav>
      {STATES.map((s, i) => (
        <section key={s.k} id={`state-${s.k}`} className={`scroll-mt-24 ${i ? "mt-20 border-t border-line-2 pt-16" : ""}`}>
          <p className="label mb-6 text-accent-ink">Stance: {s.k}</p>
          <CardView card={{ ...s.card, computedAt: checked }} />
        </section>
      ))}
      <div className="my-20 hairline-t" />
      <ul className="divide-y divide-[var(--line)]">
        {fixtureExits.map((x) => (
          <ExitRow key={x.id} x={x} showOwner />
        ))}
      </ul>
    </div>
  );
}
