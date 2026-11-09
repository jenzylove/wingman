# Build log

| When (UTC) | What now works | Proof |
|---|---|---|
| Nov 8 17:09 | Exact post time from the X post ID, post text from X's free embed | docs/spikes/post-time-and-text.md |
| Nov 8 21:00 | Behavioural crew detection on live KOL wallets (repeat co-buyers within 20s) | docs/spikes/behavioural-crew.md |
| Nov 8 21:05 | Full card from a pasted call in about 25s (caller wallets, crew, copy bots, coverage, verdict) | web/scripts/try-card.ts |
| Nov 8 21:20 | Crew engine unit tests (5 passing) | web/src/lib/engine/crew.test.ts |
| Nov 8 21:30 | WingmanExit and WingmanPool deployed on Base mainnet, Sourcify exact match | docs/DEPLOYMENTS.md |
| Nov 8 21:45 | End to end armed exit on Base mainnet: crew sells, keeper fires the rider's exit 4 seconds later, USDC lands in the rider's wallet | docs/proof/base-selftest.json |
| Nov 8 21:55 | End to end armed exit on Solana mainnet: one signature buys and creates the nonce, the exit is signed and held, crew sells, Wingman submits the held exit 4 seconds later | docs/proof/solana-selftest.json |
| Nov 9 04:40 | Security audit fixes live: verified exit signatures and per exit keys, onchain cancel check, signed Base watch lists, locked keeper endpoint, one time fire claims, real sale required to fire | commit aee5621 |
| Nov 9 05:30 | Redesign live (black, constellation, condensed type, one red accent, chevron logo); early buyers shown and watched | wingman.jdollar.site |
| Nov 9 06:40 | Crew remembered per caller; same second co buyers on 2 tokens count as crew | web/src/lib/engine/crew.test.ts |
| Nov 9 12:40 | Card leads with the crew's stance and offers only the action that fits; plain timeline; recheck | web/src/lib/ui/stance.ts |
| Nov 9 13:00 | Telegram channel post links as input; @wingmancheckerbot replies with the stance and a card link | web/src/app/api/tg/route.ts |
| Nov 9 13:40 | Fixed a typo in the Jupiter program id that made the wallet safety check refuse every Solana ride; first real ride from a browser wallet | web/src/lib/ui/ride.ts |
| Nov 9 14:10 | Solana exits rebroadcast until they land and stay armed if dropped | web/src/lib/exits/solana.ts |
| Nov 9 16:30 | Stablecoin legs counted in P&L on both chains; already wrapped SOL priced correctly | web/scripts/check-usdc-paths.ts |
| Nov 9 17:15 | Only real swaps count as trades (a buy pays, a sell receives); liquidity moves no longer fire exits; one armed exit per wallet and token; 10 tests passing | web/src/lib/engine/sol.test.ts |
