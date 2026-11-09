import { notFound } from "next/navigation";
import CardView from "@/components/CardView";
import ExitRow from "@/components/ExitRow";
import { fixtureCard, fixtureEmptyCard, fixtureExits } from "@/fixtures/cards";

export const metadata = { title: "Dev preview", robots: { index: false } };

// Dev only: renders fixtures so the card can be designed without the API.
export default function DevPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-10">
      <p className="mb-8 border-l-2 border-accent px-3 py-2 font-mono text-[12px] text-ink-2">
        Dev preview with fixture data. This route does not exist in production.
      </p>
      <CardView card={fixtureCard} />
      <div className="my-20 hairline-t" />
      <CardView card={fixtureEmptyCard} />
      <div className="my-20 hairline-t" />
      <ul className="divide-y divide-[var(--line)]">
        {fixtureExits.map((x) => (
          <ExitRow key={x.id} x={x} showOwner />
        ))}
      </ul>
    </div>
  );
}
