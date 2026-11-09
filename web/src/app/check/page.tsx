import type { Metadata } from "next";
import CheckRunner from "@/components/CheckRunner";

export const metadata: Metadata = { title: "Check a call" };

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12 lg:px-10">
      <CheckRunner key={q} q={q} />
    </div>
  );
}
