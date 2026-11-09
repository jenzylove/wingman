# Wingman

**Ride the call. Leave when they leave.**

Live at **[wingman.jdollar.site](https://wingman.jdollar.site)** on Base and Solana mainnet.

Someone posts a coin. You buy. Their crew sells into you an hour later and you find out from the chart. Wingman fixes the part you can't see.

1. **Paste the call.** An X post, a Farcaster cast, or a token address with the caller's @handle.
2. **See what they did.** Wingman reads every trade of that token around the post and shows the caller's wallets and their crew: when each one bought, and whether they already sold.
3. **Ride it.** Buy from your own wallet with an exit armed. The moment any watched wallet sells, Wingman sells your position. You leave when they leave.

## Proof on mainnet

Both exits were fired by real crew sells, four seconds after the sell landed.

| Chain | Crew sell | Wingman exit |
|---|---|---|
| Base | [0x6e7c45d7…](https://basescan.org/tx/0x6e7c45d7c740316a49dc72378da58776889546f5565e1907acd441f1ed6f3451) | [0x192ee870…](https://basescan.org/tx/0x192ee870ee0aff8530e4c559a7b1491c80ba09ab914c2f4818a1b1678b6f98ab) |
| Solana | [2B895t7W…](https://solscan.io/tx/2B895t7WRjubh58fmoTnXzJckTZuiajBCbXKw6Z4NXRNxWv9FWaxXfGLqKZu9GXt8WWXk2JkHTCRoYkayxMxneEf) | [24b66AKb…](https://solscan.io/tx/24b66AKbtPdgr1BsAftWaURG3M8vc6nWYaxP85JDjqt7HyUJXwrz32MQuFmDyBbd3WkyYpVFxFSQMFhmVRYtMznc) |

Full records: [docs/proof](docs/proof). Contracts: [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md).

## How Wingman finds the crew

* **Claimed:** wallets the caller linked to their handle.
* **Public:** the Kolscan KOL list and Farcaster verified wallets.
* **Repeat:** wallets that bought within 20 seconds of the caller on 3 or more of their recent tokens.
* **Early:** wallets that bought in the 3 minutes before the post. Wingman remembers them per caller, and a wallet that shows up early on 2 or more of the same caller's posts becomes crew.

Every card says what it could see, so a thin read is labelled thin.

## How exits work

**Base.** You approve the exact amount and arm it on the [WingmanExit](https://basescan.org/address/0x589edbbEC1a8B2e9f17A34d5419Dc371dF052734) contract, then sign the list of wallets to watch. A keeper reads every new block. When a watched wallet sells the token in a real swap, the keeper calls `fire`, which sells through KyberSwap to USDC with a floor at 50% of the quote at arm time. Proceeds can only go to you. Cancel anytime.

**Solana.** Your buy and a durable nonce go out in one transaction. You then sign the exit sell on that nonce, with a minimum out fixed at arm time. Wingman holds the signed sell and submits it the moment a Helius webhook reports a watched wallet selling. Cancel by closing the nonce, which voids the held sell.

**Trust.** The keeper can only call `fire` on an exit you armed, and only for the amount you approved. The contract owner can change the keeper, the allowed routers and the fee wallet. Nobody can move your tokens anywhere except a sale whose USDC goes to you, and never below your floor. On Solana, Wingman holds a sell you signed and decides when to send it, so you trust it to send on time; it can never change what that sell does.

## Fees and $VIBES

0.5% on exits only. Stake 100k $VIBES in [WingmanPool](https://basescan.org/address/0xFAB3EF16Dfc77eef95b68A259853195B2b589fBd) and your exits are free. 30% of every exit fee goes to WingmanPool stakers.

## Run it

```bash
cd contracts && forge install && forge test
cd ../web && cp ../.env.example ../.env  # fill in keys
npm install && npm test && npm run dev
```

Stack: Next.js 15, viem and wagmi, Solana web3.js, Helius, 0x, Jupiter, KyberSwap, Neynar, Upstash Redis, Foundry.

## License

MIT
