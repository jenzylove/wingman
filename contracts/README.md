# Wingman contracts (Base)

Two contracts that let Wingman sell a token for you the moment the caller's crew starts selling, without ever holding your funds.

## WingmanExit

1. You approve a token to WingmanExit and call `arm(token, amount, maxSlippageBps)`. Slippage is capped at 30%. `armWithFloor` also takes a hard USDC floor for the whole sale.
2. When the crew sells, the keeper calls `fire`. The contract pulls at most the armed amount (never more than your balance or allowance), approves exactly that to an allowlisted router, swaps, and resets the approval to zero.
3. Output is measured by balance changes, so fee on transfer tokens work and stray balances never count. If USDC out is below `quotedOut` minus your slippage (or below your floor), the whole call reverts.
4. Any token the router did not spend goes back to you. USDC goes only to you, minus a 0.5% fee. 30% of the fee goes to VIBES stakers through WingmanPool, 70% to the treasury.
5. No fee if you hold plus stake at least 100,000 VIBES.

You can `cancel(id)` any time, or simply revoke the approval.

What the keeper can do: pick the moment, the router (from the allowlist) and the route. What it cannot do: pull more than you armed, send proceeds anywhere but you, call a token directly, or touch funds outside a single swap.

## WingmanPool

Stake VIBES, earn USDC from exit fees. `stake`, `unstake` any time, `claim`. Rewards arrive only via `notifyReward` (pulled from the caller). With nobody staked the reward goes to the treasury.

## Addresses used

| What | Base address |
| --- | --- |
| USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| VIBES | 0xefFC8815487084a97edfdfF968b56Ea123421Acb |
| KyberSwap MetaAggregationRouterV2 | 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 |
| Uniswap UniversalRouter (not on the deployed allowlist) | 0x6fF5693b99212Da76ad316178A184AB56D299b43 |

## Run

```
forge test
```

Real swap through KyberSwap on a Base fork, with calldata built live by the KyberSwap API (needs Node):

```
FOUNDRY_PROFILE=fork BASE_RPC=https://base-rpc.publicnode.com forge test --match-contract Fork -vv
```

## Deploy

The signer is a Foundry keystore account, never a raw key.

```
cast wallet import wingman-deployer --interactive
KEEPER=0x... TREASURY=0x... forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.base.org --account wingman-deployer --broadcast
```

`OWNER` is optional and defaults to the deployer.

## Dependencies

Run `forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 foundry-rs/forge-std --no-git` inside `contracts/` before building.
