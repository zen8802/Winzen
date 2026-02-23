# Winzen — Virtual Prediction Markets

A free, virtual-coin prediction market app (Kalshi/Polymarket style) with **yes/no** and **multiple choice** markets. No real money; everyone plays with virtual coins.

## Features

- **Virtual coins** — New users get 1,000 coins (configurable via `INITIAL_COINS` in `.env`)
- **Yes/No markets** — Binary outcomes (e.g. "Will X happen?")
- **Multiple choice** — Several options per market
- **Parimutuel resolution** — Pool is split among winning bettors proportionally when the market is resolved
- **Portfolio** — View balance, bets, and transaction history
- **Web + PWA-ready** — Use in browser or add to home screen for an app-like experience

## Tech stack

- **Next.js 14** (App Router), TypeScript, Tailwind CSS
- **Prisma** + SQLite (easy to swap to PostgreSQL later)
- **NextAuth** (credentials: email + password)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` — e.g. `file:./dev.db` for SQLite
   - `NEXTAUTH_SECRET` — run `openssl rand -base64 32` to generate one
   - `NEXTAUTH_URL` — e.g. `http://localhost:3000`
   - `INITIAL_COINS` — starting balance for new users (default 1000)

3. **Database**

   ```bash
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```

   Seed creates a demo user: **demo@winzen.app** / **demo123** and two sample markets.

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | Start dev server           |
| `npm run build`| Production build           |
| `npm run start`| Start production server    |
| `npm run db:seed` | Seed demo user + markets |

## How it works

1. **Create a market** — Log in, go to "Create", add a question, choose yes/no or multiple choice, set outcomes and close time.
2. **Place bets** — On an open market, pick an outcome and stake coins. Your balance is debited.
3. **Resolve** — After the close time, the market creator chooses the winning outcome. The total pool is distributed to winning bettors in proportion to their stake (parimutuel).

No real money is ever involved; everything uses virtual coins.
