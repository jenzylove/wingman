import type { Metadata } from "next";
import MyExits from "@/components/MyExits";

export const metadata: Metadata = { title: "My exits" };

export default function ExitsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
      <p className="text-[11px] uppercase tracking-[0.2em] text-green-ink">My exits</p>
      <h1 className="mt-2 font-display text-[30px] font-semibold tracking-tight sm:text-[44px]">Armed and fired</h1>
      <p className="mt-3 max-w-xl text-[14px] text-ink-2">
        Every armed exit watches the caller and crew wallets you picked. When one of them sells, your exit fires and you get a receipt with both transactions.
      </p>
      <MyExits />
    </div>
  );
}
