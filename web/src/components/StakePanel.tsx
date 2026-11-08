"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { base } from "wagmi/chains";
import { useAccount, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { FREE_EXIT_THRESHOLD, POOL_ADDRESS, REWARD_DECIMALS, REWARD_SYMBOL, VIBES_ADDRESS, VIBES_DECIMALS, erc20Abi, poolAbi } from "@/lib/ui/pool";
import { num } from "@/lib/ui/format";
import WalletMenu from "./WalletMenu";

function fmt(v: bigint | undefined, d: number): string {
  if (v === undefined) return "…";
  return num(Number(formatUnits(v, d)), 2);
}

function Live({ pool, vibes, user }: { pool: Address; vibes: Address; user: Address }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"stake" | "unstake">("stake");
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const reads = useReadContracts({
    contracts: [
      { address: vibes, abi: erc20Abi, functionName: "balanceOf", args: [user], chainId: base.id },
      { address: vibes, abi: erc20Abi, functionName: "allowance", args: [user, pool], chainId: base.id },
      { address: pool, abi: poolAbi, functionName: "staked", args: [user], chainId: base.id },
      { address: pool, abi: poolAbi, functionName: "earned", args: [user], chainId: base.id },
      { address: pool, abi: poolAbi, functionName: "totalStaked", chainId: base.id },
    ],
    query: { refetchInterval: 15_000 },
  });
  const [bal, allowance, staked, earned, total] = (reads.data ?? []).map((r) => (r.status === "success" ? (r.result as bigint) : undefined));
  const readError = reads.data?.find((r) => r.status === "failure");

  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  useEffect(() => {
    if (receipt.isSuccess) reads.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  let parsed: bigint | null = null;
  try {
    parsed = amount ? parseUnits(amount, VIBES_DECIMALS) : null;
  } catch {
    parsed = null;
  }
  const needsApprove = mode === "stake" && parsed !== null && allowance !== undefined && allowance < parsed;
  const busy = write.isPending || receipt.isLoading;
  const wrongChain = chainId !== base.id;
  const stakedNum = staked !== undefined ? Number(formatUnits(staked, VIBES_DECIMALS)) : 0;
  const free = stakedNum >= FREE_EXIT_THRESHOLD;

  function act() {
    if (wrongChain) return switchChain({ chainId: base.id });
    if (!parsed) return;
    if (needsApprove) return write.writeContract({ address: vibes, abi: erc20Abi, functionName: "approve", args: [pool, parsed], chainId: base.id });
    write.writeContract({ address: pool, abi: poolAbi, functionName: mode, args: [parsed], chainId: base.id });
  }

  return (
    <div className="grid gap-14 lg:grid-cols-[1fr_1fr]">
      <div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-ink-3">You stake</dt>
            <dd className="mt-2 font-display text-[26px] font-semibold">{fmt(staked, VIBES_DECIMALS)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-ink-3">Claimable</dt>
            <dd className="mt-2 font-display text-[26px] font-semibold text-green-ink">
              {fmt(earned, REWARD_DECIMALS)} <span className="text-[14px] text-ink-3">{REWARD_SYMBOL}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-ink-3">Wallet balance</dt>
            <dd className="mt-2 text-[16px]">{fmt(bal, VIBES_DECIMALS)} $VIBES</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-ink-3">Pool total</dt>
            <dd className="mt-2 text-[16px]">{fmt(total, VIBES_DECIMALS)} $VIBES</dd>
          </div>
        </dl>
        <div className="mt-8">
          <p className="text-[13px] text-ink-2">
            {free ? (
              <span className="text-green-ink">Your exits are free.</span>
            ) : (
              <>Stake {num(Math.max(0, FREE_EXIT_THRESHOLD - stakedNum), 0)} more $VIBES for free exits.</>
            )}
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line-2">
            <div className="h-full rounded-full bg-green transition-all" style={{ width: `${Math.min(100, (stakedNum / FREE_EXIT_THRESHOLD) * 100)}%` }} />
          </div>
        </div>
        {readError && <p className="mt-4 text-[12px] text-red-ink">Could not read the pool. The contract may not match this page yet.</p>}
      </div>

      <div className="rounded-2xl bg-bg-2 p-5 sm:p-6">
        <div className="flex gap-1 rounded-xl bg-bg p-1" role="tablist">
          {(["stake", "unstake"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`h-10 flex-1 rounded-lg text-[13px] capitalize ${mode === m ? "bg-bg-3 text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <label htmlFor="stake-amt" className="mt-5 block text-[11px] uppercase tracking-[0.18em] text-ink-3">
          Amount
        </label>
        <div className="mt-2 flex items-center rounded-xl bg-bg ring-1 ring-line-2 focus-within:ring-2 focus-within:ring-green">
          <input
            id="stake-amt"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            className="h-14 min-w-0 flex-1 bg-transparent px-4 font-display text-[22px] tabular-nums focus:outline-none"
          />
          <button
            type="button"
            className="mr-3 rounded-md px-2 py-1 text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink"
            onClick={() => {
              const v = mode === "stake" ? bal : staked;
              if (v !== undefined) setAmount(formatUnits(v, VIBES_DECIMALS));
            }}
          >
            Max
          </button>
        </div>
        <button
          type="button"
          onClick={act}
          disabled={busy || (!wrongChain && !parsed)}
          className="mt-4 h-12 w-full rounded-xl bg-green font-display text-[14px] font-semibold text-on-accent disabled:opacity-40"
        >
          {wrongChain ? "Switch to Base" : busy ? "Confirm in your wallet…" : needsApprove ? "Approve $VIBES" : mode === "stake" ? "Stake" : "Unstake"}
        </button>
        <button
          type="button"
          onClick={() => write.writeContract({ address: pool, abi: poolAbi, functionName: "claim", chainId: base.id })}
          disabled={busy || wrongChain || !earned}
          className="mt-2 h-12 w-full rounded-xl bg-bg-3 text-[13px] text-ink disabled:opacity-40"
        >
          Claim {fmt(earned, REWARD_DECIMALS)} {REWARD_SYMBOL}
        </button>
        {write.error && <p className="mt-3 text-[12px] text-red-ink">{write.error.message.split("\n")[0]}</p>}
        {write.data && (
          <a href={`https://basescan.org/tx/${write.data}`} target="_blank" rel="noreferrer" className="mt-3 block text-[12px] text-ink-3 underline underline-offset-2">
            {receipt.isSuccess ? "Confirmed. View transaction" : "Sent. View transaction"}
          </a>
        )}
      </div>
    </div>
  );
}

export default function StakePanel() {
  const { address } = useAccount();
  if (!POOL_ADDRESS || !VIBES_ADDRESS) {
    return (
      <div className="max-w-xl">
        <p className="font-display text-[20px]">Pool not deployed yet.</p>
        <p className="mt-2 text-[14px] text-ink-2">
          The staker pool contract is not live on this deployment. Nothing here can be staked until it is, and we will not show made up numbers.
        </p>
      </div>
    );
  }
  if (!address) {
    return (
      <div className="max-w-xl">
        <p className="text-[14px] text-ink-2">Connect a Base wallet to stake $VIBES.</p>
        <div className="mt-5">
          <WalletMenu />
        </div>
      </div>
    );
  }
  return <Live pool={POOL_ADDRESS} vibes={VIBES_ADDRESS} user={address} />;
}
