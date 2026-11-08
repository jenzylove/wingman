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
