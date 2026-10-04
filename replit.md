# Aura — AI Travel Planner

A luxury AI travel concierge that generates beautifully formatted, personalized itineraries from user preferences and supports follow-up chat per trip.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/travel-planner run dev` — run the frontend (dynamic port)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, path `/api`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind + shadcn/ui
- AI: OpenAI (via Replit AI Integration) — model `gpt-5.4`

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth OpenAPI spec
- `lib/db/src/schema/` — Drizzle ORM table definitions (itineraries, conversations, messages)
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/travel-planner/src/pages/` — React page components

## Architecture decisions

- Contract-first API: OpenAPI spec drives all client/server types via Orval codegen
- SSE streaming for itinerary generation and AI chat (no polling)
- Itinerary content stored as raw markdown in Postgres; parsed into sections on the frontend
- AI chat is per-itinerary via a conversation/message model, with full message history sent on each turn for context
- `gpt-5.4` with `max_completion_tokens: 8192` for rich, comprehensive itineraries

## Product

- **Home**: Hero landing with recent itineraries and global stats
- **Trip Planner** (`/itinerary/new`): Form → real-time streaming AI generation → auto-redirect to detail
- **My Journeys** (`/itineraries`): Saved itinerary card grid with delete
- **Itinerary Detail** (`/itineraries/:id`): Collapsible section view + inline AI chat panel

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- DB table exports: `conversations`, `messages`, `itineraries` (no `Table` suffix)
- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`
- Never run `pnpm dev` at workspace root — use workflow restart or per-package `--filter`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
