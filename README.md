# Wingman

**Ride the call. Leave when they leave.**

Live at **[wingman.jdollar.site](https://wingman.jdollar.site)** on Base and Solana mainnet. Watch the [demo](https://youtu.be/OGQNypU-HnA). Follow [@callwingman](https://x.com/callwingman). Telegram bot: [@wingmancheckerbot](https://t.me/wingmancheckerbot).

Someone posts a coin. You buy. Their crew sells into you an hour later and you find out from the chart. Wingman fixes the part you can't see.

This is documented: on Nov 5 2026, [Bubblemaps](https://blog.bubblemaps.io/bubblemaps-investigates-crypto-kol-moves-onchain/) traced one KOL's 5 linked wallets buying before 61% of his 534 October calls, about 20 seconds ahead, and selling within minutes for an estimated $130K. That took an investigation. Wingman does the same kind of read on any call in about half a minute, before you buy.

1. **Paste the call.** An X post, a public Telegram channel post, a Farcaster cast, or a token address with the caller's @handle. Or forward it to [@wingmancheckerbot](https://t.me/wingmancheckerbot) on Telegram.
2. **Get the answer first.** Wingman reads every trade of that token around the post and leads with one line: CREW STILL IN, CREW IS SELLING, or CREW IS OUT. DON'T CHASE. Then what happened, with exact times and every transaction linked.
3. **Ride it.** Buy from your own wallet with an exit armed. The moment any watched wallet sells, Wingman sells your position. You leave when they leave.

## Proof on mainnet

Exits fire four seconds after a watched wallet sells. These were run with our own wallets playing crew and rider, so every step is a real mainnet transaction.

| Chain | Crew sell | Wingman exit |
|---|---|---|
| Base | [0x6e7c45d7…](https://basescan.org/tx/0x6e7c45d7c740316a49dc72378da58776889546f5565e1907acd441f1ed6f3451) | [0x192ee870…](https://basescan.org/tx/0x192ee870ee0aff8530e4c559a7b1491c80ba09ab914c2f4818a1b1678b6f98ab) |
| Solana | [2B895t7W…](https://solscan.io/tx/2B895t7WRjubh58fmoTnXzJckTZuiajBCbXKw6Z4NXRNxWv9FWaxXfGLqKZu9GXt8WWXk2JkHTCRoYkayxMxneEf) | [24b66AKb…](https://solscan.io/tx/24b66AKbtPdgr1BsAftWaURG3M8vc6nWYaxP85JDjqt7HyUJXwrz32MQuFmDyBbd3WkyYpVFxFSQMFhmVRYtMznc) |

Full records: [docs/proof](docs/proof). Contracts: [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md).

## How Wingman finds the crew

* **Claimed:** wallets the caller linked to their handle.
* **Public:** the Kolscan KOL list and Farcaster verified wallets.
* **Repeat:** wallets that bought within 20 seconds of the caller on 3 or more of their recent tokens, or in the very same second on 2 or more. Once a wallet qualifies, Wingman remembers it as that caller's crew.
* **Early:** wallets that bought in the 3 minutes before the post. Wingman remembers them per caller, and a wallet that shows up early on 2 or more of the same caller's posts becomes crew.

Claimed and public wallets are the caller's own. Repeat and early wallets are linked by behaviour, trading alongside the caller, not by proven ownership, and every card labels which is which. Every card also says what it could see, so a thin read is labelled thin. Today Wingman learns from up to 3 of a caller's wallets and their last 16 tokens, and it does not trace funding links between wallets yet.

## How exits work

**Base.** You approve the exact amount and arm it on the [WingmanExit](https://basescan.org/address/0x589edbbEC1a8B2e9f17A34d5419Dc371dF052734) contract, then sign the list of wallets to watch. A keeper reads every new block. When a watched wallet sells the token in a real swap, the keeper calls `fire`, which sells through KyberSwap to USDC with a floor at 50% of the quote at arm time. Proceeds can only go to you. Cancel anytime.

**Solana.** Your buy and a durable nonce go out in one transaction. You then sign the exit sell on that nonce, with a minimum out fixed at arm time. Wingman holds the signed sell and submits it the moment a Helius webhook reports a watched wallet selling. Cancel by closing the nonce, which voids the held sell.

**Trust.** The keeper can only call `fire` on an exit you armed, and only for the amount you approved. The contract owner can change the keeper, the allowed routers and the fee wallet. Nobody can move your tokens anywhere except a sale whose USDC goes to you, and never below your floor. On Base the keeper decides that a watched wallet sold; the contract can't check that itself, so you trust the keeper on timing, never on where the money goes. On Solana, Wingman holds a sell you signed and decides when to send it, so you trust it to send on time; it can never change what that sell does. You can cancel any armed exit from My Exits at any time. The contracts are tested (31 Foundry tests plus a mainnet fork test) but have not had a third party audit.

## How it was built

Built solo in about two days with Claude Code (Claude Opus) doing the engineering, and the owner making every product call.

* **Spec first.** [docs/PRD.md](docs/PRD.md) and [docs/PLAN.md](docs/PLAN.md) were written before any code; the PRD now opens with what actually shipped.
* **Spikes before building.** Exact post times from X post IDs and behavioural crew detection were proven against real trades first: [docs/spikes](docs/spikes).
* **Parallel agents.** Separate Claude agents ran the redesign, a security audit, and an independent judge that scored the live app with no build context. Their findings were fixed and verified live; the fixes are listed in [docs/BUILD_LOG.md](docs/BUILD_LOG.md).
* **Real data, not mocks.** Self tests on mainnet ([web/scripts/base-proof.ts](web/scripts/base-proof.ts), [web/scripts/sol-proof.ts](web/scripts/sol-proof.ts)) and checks that push real trades through every quote path ([web/scripts/check-usdc-paths.ts](web/scripts/check-usdc-paths.ts)). Engine tests: `cd web && npm test`. Contract tests: `cd contracts && forge test`.

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
