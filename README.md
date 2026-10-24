# Synaps

Every AI model, one wallet. Pay-per-message chat and an OpenAI-compatible API, billed from a USD balance topped up with ETH (Robinhood Chain, Base) or USDC (Base).

## Stack
- Next.js (App Router), React 19
- three.js + GSAP ScrollTrigger + Lenis for the landing page
- Supabase (Postgres) for balances, top-ups, API keys and usage (`syn_*` tables)
- OpenRouter as the model router
- viem for wallet sign-in and on-chain top-up verification

## Environment
See `.env.example`. Required: `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `NEXT_PUBLIC_TREASURY`.

## How billing works
1. Wallet signs a message (no gas) → session cookie.
2. Top-up: wallet sends ETH/USDC to the treasury, the server checks the receipt on-chain and credits USD once per transaction.
3. Each request is billed at OpenRouter's reported cost × (1 + `MARKUP`).
4. Free models (`:free`) need no wallet, limited per IP per day (`FREE_DAILY_LIMIT`).

## Routes
- `/` landing · `/app` chat · `/app/wallet` · `/app/keys` · `/app/models` · `/docs`
- API: `POST /api/v1/chat/completions`, `GET /api/v1/models`
