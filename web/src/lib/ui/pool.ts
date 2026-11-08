import { erc20Abi, isAddress, type Address } from "viem";

/**
 * WIRING POINT: align this ABI with the deployed staker pool contract.
 * Assumed: stake(amount), unstake(amount), claim(), staked(user), earned(user), totalStaked().
 */
export const poolAbi = [
  { type: "function", name: "stake", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "unstake", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "staked", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "earned", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalStaked", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export { erc20Abi };

function addr(v: string | undefined): Address | null {
  return v && isAddress(v) ? (v as Address) : null;
}

export const POOL_ADDRESS = addr(process.env.NEXT_PUBLIC_POOL_ADDRESS);
export const VIBES_ADDRESS = addr(process.env.NEXT_PUBLIC_VIBES_ADDRESS);
export const VIBES_DECIMALS = Number(process.env.NEXT_PUBLIC_VIBES_DECIMALS ?? 18);
export const REWARD_SYMBOL = process.env.NEXT_PUBLIC_POOL_REWARD_SYMBOL ?? "USDC";
export const REWARD_DECIMALS = Number(process.env.NEXT_PUBLIC_POOL_REWARD_DECIMALS ?? 6);
export const FREE_EXIT_THRESHOLD = 100_000;
