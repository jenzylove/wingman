# Wingman: plan

> Original plan from Nov 8. What shipped differs: see "As built" at the top of PRD.md and the build log.

Deadline: Mon Nov 9 2026 22:00 UTC. Locked Sun Nov 8 ~17:00 UTC.

| # | Phase | Done when |
|---|---|---|
| 0 | Spikes: post time and text without the X API; early buyers of a token around a timestamp on Solana and Base; one restricted sell-only permission on Base | Spike notes in docs/spikes with real output |
| 1 | Crew engine as pure functions with tests (window, repeat pattern, funding link, coverage) | Unit tests pass on recorded real data |
| 2 | Data layer: call reader, wallet sources, buyer windows, prices | A real Bubblemaps case reproduced from transactions |
| 3 | Card and caller pages on the live URL | A judge pastes a real call and gets a linked card |
| 4 | Armed exits: Base session permission and Solana delegate, watcher, triggered sell | A real armed exit fires on mainnet and links both txs |
| 5 | $VIBES staking check, fee split contract, staker claim | Real fee and claim txs on Base |
| 6 | /proof backtest, receipts, design pass | Screenshots approved |
| 7 | Release readiness audit and fixes | Findings fixed or listed in limits |
| 8 | README, demo video, post, submission | Submitted |

## Risks
| Risk | Status |
|---|---|
| Free post time and text | Proven (spike 1) |
| Early buyer data per token per window | Needs spike (Helius on Solana, logs on Base) |
| Sell-only permission on Base smart wallets | Needs spike |
| Crew history for a caller with few calls in our DB | Known; seed by ingesting public KOL wallet trades, show coverage honestly |
| Defamation | Known; factual cards, tiers, right of reply |
