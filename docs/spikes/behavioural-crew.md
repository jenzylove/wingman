# Spike: find a caller's crew from behaviour alone

Question: without funding links, can we find wallets that keep buying the same tokens within seconds of a caller?

Run (Nov 8 2026, Helius enhanced transactions): take the caller's last 300 transactions, keep swaps the caller signed, then for each token pull that token's swaps within 20 seconds of the caller's buy and count which signers repeat. Script: spikes/crew-spike.mjs.

Data: KOL wallet to X handle map from the public Kolscan leaderboard dataset (472 unique Solana wallets, 104 active in the last 24h).

Output for J Spizzle (x.com/JSpizzleCrypto, 4z3WtX…m4A), 8 tokens bought today:
- BTauop…ESUK bought within 20s on 4 of 8
- 68MyBw…s5xo and F3xbw8…yBwb on 3 of 8
- six more wallets on 2 of 8

Verdict: proven. Repeat co-buyers show up from public data alone. Next: split by sign (before or same second = crew, after = copy bots) and add funding links and sells.

Also found: Etherscan free tier does not cover Base; base-rpc.publicnode.com serves eth_getLogs over ~3000 block ranges for free. mainnet.base.org rate limits getLogs.
