# Wingman: PRD

## As built (Nov 9 2026)
The sections below are the original plan from Nov 8. This is what actually shipped, so read this first.

* **Input:** X post links, public Telegram channel post links, Farcaster casts, a token address with an optional @handle, or a call forwarded to @wingmancheckerbot. A handle alone is not supported.
* **Wallet sources:** wallets the caller claimed, the Kolscan KOL list, Farcaster verified wallets, repeat co buyers (within 20s on 3+ recent tokens, or the same second on 2+, remembered per caller), and early buyers in the 3 minutes before the post. Not built: Basename and ENS lookups, funding link tracing. Repeat and early wallets are behaviour, not proven ownership.
* **Card:** leads with the crew's stance (still in, selling, out, none) and offers only the action that fits; a plain timeline; the full trade strip behind a toggle; recheck when older than 10 minutes.
* **Exits on Base:** the WingmanExit contract (exact approval, USDC floor at 50% of the quote at arm time, keeper only fire, proceeds only to the owner), not a smart wallet session permission.
* **Exits on Solana:** buy plus a durable nonce in one transaction; the exit sell is signed in advance and held; Wingman submits it when a Helius webhook shows a watched wallet selling in a real swap. Not a token delegate.
* **One armed exit per wallet and token.**
* **Not built:** clean caller badge, right of reply flow, the ERC-8004 build agent identity, and the /proof backtest (the proof page lists real exits instead).
* **Proof:** mainnet self tests with our own wallets on both chains, 4 seconds from crew sell to exit.

## One liner
Ride a call, and leave when they leave. Paste any call and Wingman shows what the caller and their crew did. Then you can ride it with an exit armed that sells the moment the crew starts selling.

## Problem
A caller posts "this is going to send". Followers buy. The caller and a crew of side wallets bought seconds before the post, and they sell into the followers minutes later.

* Bubblemaps (Nov 5 2026): one caller's 5 linked wallets bought before 61% of 534 calls, about 20 seconds ahead, and sold minutes later (~$130K). Another's 3 side wallets bought in the same second as his public wallet and sold within about 3 minutes (~$125K). ([Bubblemaps](https://blog.bubblemaps.io/bubblemaps-investigates-crypto-kol-moves-onchain/))
* Today, catching this takes a manual investigation. Followers decide in seconds with nothing, and by the time anyone notices the dump, it's over.

**Reframe:** followers don't have a "which call is good" problem. They have a "who leaves first" problem.

## User and front door
A crypto native who buys tokens off calls on X, Telegram or Farcaster, on Solana or Base.

First ten seconds: "Paste a call." An X post link, a cast, a token address or a caller handle. In about 20 seconds you see the Wingman card.

## Full scope
1. **Call reader.** Post time to the millisecond from the post ID, and text and author from X's free embed. Casts via Neynar. The token is pulled from the post text (address or cashtag), or pasted.
2. **Crew engine.**
   * Known caller wallets from public sources (KOL wallet lists for Solana and Base, Basename and ENS records, Farcaster verified addresses), each stored with the proof link and a tier: verified by the caller, public link, or behavioural.
   * Behavioural crew: wallets that bought this token in the window before the post, and that repeat that pattern across this caller's other calls in our database. That catches bot wallets with no funding link to the caller.
   * Funding links: wallets funded by a known caller wallet.
3. **The card.** What the caller and crew did: bought how long before the post, sold how long after, estimated take from followers, and a coverage meter for how much of the early volume we can attribute. It's factual, every line links to a transaction, and the caller has a right of reply.
4. **Ride with an exit armed.**
   * Base: a smart wallet gives Wingman a session permission limited to selling that one token into USDC or ETH. Wingman can't withdraw or touch anything else.
   * Solana: the same rule, enforced by a restricted delegate on the user's token account plus a server signer that can only route that token into USDC through Jupiter.
   * A watcher streams the crew's wallets. The first crew sell triggers the user's exit within seconds.
5. **Exit receipt card**, shareable: "Crew started selling 12:03:41. You were out 12:03:43. +18%."
6. **Caller pages and clean caller badge.** A caller signs from their wallet to claim it. Their record across calls is public.
7. **$VIBES.** Stakers of 100,000+ $VIBES on Base get armed exits free. Everyone else pays 0.5% of the exit. 30% of exit fees go to a $VIBES staker pool, claimable onchain.
8. **/proof.** A backtest over recent real calls, each verdict linked to transactions, plus a live list of real armed exits and fills.

Nothing was cut in the plan; see "As built" at the top for what shipped.

## Rubric mapping (Vibeathon 02)
| Criterion | Weight | How it's met |
|---|---|---|
| Execution | 30% | Paste a real call and get a real card. Arm a real exit with a judge's own wallet on Base. Every fill is on an explorer. |
| Launch potential | 25% | Every degen rides calls. Stakers earn from exits. Cards spread themselves. |
| Originality | 20% | No product finds a caller's crew by behaviour and exits when the crew sells. Nothing covers callers on Base. |
| Craft and UX | 15% | Paste, card, Ride, receipt. One flow. |
| Vibecoding leverage | 10% | Built end to end with Claude Code. Build log in docs/BUILD_LOG.md. ERC-8004 identity for the build agent. |

## Claims and proof
| Claim | Proof |
|---|---|
| Post time is exact | Derived from the post ID; shown on the card |
| Crew wallets bought before the post | Each buy links to its transaction with seconds before the post |
| An armed exit sells only that token | The permission scope is shown, and a test shows other calls revert |
| The exit fired after the crew sold | Both transactions linked, with the time gap |
| Stakers earn | Fee split visible in the contract and claim transactions |

## What it does not do
* It doesn't promise to catch every side wallet. The coverage meter says how much it sees.
* It doesn't call anyone a scammer. It shows transactions.
* It doesn't hold your funds.

## Vibestarter checklist (becomes docs/SUBMISSION_CHECKLIST.md)
* [ ] Working MVP with a live URL (wingman.jdollar.site)
* [ ] Net new work during the build window
* [ ] Submitted before Nov 9 2026 22:00 UTC
* [ ] Optional Fundable link
* [ ] Any extra form fields, read from the submit form
