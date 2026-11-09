import type { Metadata } from "next";
import MyExits from "@/components/MyExits";

export const metadata: Metadata = { title: "My exits" };

export default function ExitsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-10">
      <p className="label text-accent-ink">My exits</p>
      <h1 className="mt-4 font-display text-[64px] leading-[0.88] sm:text-[104px]">Armed and fired</h1>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">
        Every armed exit watches the wallets you picked. When one of them sells the token in a real swap, your exit fires and you get a receipt with both transactions.
      </p>
      <MyExits />
    </div>
  );
}
