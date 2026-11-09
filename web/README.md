# Wingman web app

The Next.js app behind [wingman.jdollar.site](https://wingman.jdollar.site). See the [main README](../README.md) for what it does.

```bash
cp ../.env.example ../.env   # fill in keys
npm install
npm test                     # engine tests
npm run dev
```

* `src/lib/engine`: reading calls, trades and crews (Solana via Helius, Base via RPC)
* `src/lib/exits`: armed exits (Solana durable nonce, Base WingmanExit)
* `src/app/api`: card, exits, keeper, Helius webhook and Telegram bot routes
* `scripts`: mainnet self tests and data checks
