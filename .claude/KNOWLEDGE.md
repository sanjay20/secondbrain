# SecondBrain — Architecture & Operations Guide

## Table of Contents
1. [Overview](#overview)
2. [Repository Layout](#repository-layout)
3. [Architecture](#architecture)
4. [Database](#database)
5. [AI Layer](#ai-layer)
6. [Authentication](#authentication)
7. [Deployment & Hosting](#deployment--hosting)
8. [Environment Variables](#environment-variables)
9. [Build, Start & Stop](#build-start--stop)
10. [Development Workflow](#development-workflow)
11. [Adding a New Feature Module](#adding-a-new-feature-module)
12. [Agentic Development Workflow](#agentic-development-workflow)

---

## Overview

SecondBrain is an AI-powered personal life-OS built as a **pnpm + Turborepo monorepo**.  
Stack: Next.js 15 (App Router) · Prisma · PostgreSQL · Clerk auth · multi-provider AI (Gemini / Anthropic / Groq).  
Public URL: **https://colt-tidings-wad.ngrok-free.dev** (served via a systemd ngrok tunnel on the host machine).

---

## Repository Layout

```
secondbrain/                     ← repo root
├── apps/
│   └── web/                     ← Next.js 15 application  (@secondbrain/web)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/      ← sign-in / sign-up (Clerk)
│       │   │   ├── (dashboard)/ ← all protected pages
│       │   │   │   ├── dashboard/
│       │   │   │   ├── health/
│       │   │   │   ├── career/
│       │   │   │   ├── knowledge/
│       │   │   │   ├── journal/
│       │   │   │   └── ai-coach/
│       │   │   └── api/
│       │   │       ├── ai/      ← AI insight endpoints (one per feature)
│       │   │       ├── goals/   ← CRUD
│       │   │       ├── habits/  ← CRUD + logging
│       │   │       ├── journals/← CRUD
│       │   │       ├── skills/  ← CRUD
│       │   │       ├── user/
│       │   │       └── webhooks/clerk/
│       │   ├── components/
│       │   │   ├── career/      ← GoalCard, GoalForm, SkillBadge
│       │   │   ├── dashboard/   ← DailyBriefing, StatsCard
│       │   │   ├── health/      ← HabitCard, HabitForm
│       │   │   ├── layout/      ← Sidebar, Header, MobileNav
│       │   │   └── ui/          ← shadcn/ui primitives
│       │   ├── lib/
│       │   │   ├── auth.ts      ← requireUser() helper (Clerk → Prisma)
│       │   │   ├── db.ts        ← singleton PrismaClient
│       │   │   └── utils.ts     ← cn() classname helper
│       │   └── middleware.ts    ← Clerk auth gate (all routes except /sign-in, /sign-up, /api/webhooks)
│       └── next.config.ts
│
├── packages/
│   ├── ai-core/                 ← @secondbrain/ai-core
│   │   └── src/
│   │       ├── agents/          ← one agent per feature
│   │       │   ├── briefing-agent.ts
│   │       │   ├── health-agent.ts
│   │       │   ├── career-agent.ts
│   │       │   ├── knowledge-agent.ts
│   │       │   └── journal-agent.ts
│   │       ├── ai-config.ts     ← per-feature model + token budget config
│   │       ├── client.ts        ← Anthropic SDK client + model name constants
│   │       ├── provider.ts      ← unified chat/streamChat for Anthropic/Gemini/Groq
│   │       ├── shared.ts        ← shouldMockAI(), aiErrorMessage()
│   │       └── index.ts         ← public exports
│   │
│   ├── db/                      ← @secondbrain/db
│   │   ├── prisma/schema.prisma ← single source of truth for all models
│   │   └── src/index.ts         ← re-exports PrismaClient singleton
│   │
│   └── types/                   ← @secondbrain/types
│       └── src/index.ts         ← shared TypeScript interfaces (Goal, Skill, JournalEntry, …)
│
├── docker-compose.yml           ← local Postgres (port 5432) + Redis (port 6379)
├── turbo.json                   ← Turborepo task graph
├── pnpm-workspace.yaml
└── .env.local                   ← real secrets (not committed)
```

---

## Architecture

### Request flow (production)

```
Browser
  │
  ▼
ngrok tunnel (colt-tidings-wad.ngrok-free.dev)
  │  systemd: secondbrain-tunnel.service
  ▼
localhost:3000
  │  systemd: secondbrain-web.service  (next start, NODE_ENV=production)
  ▼
Next.js 15 App Router
  │
  ├─ Clerk middleware (src/middleware.ts) — every request passes through here
  │   └─ Unauthenticated → redirect to /sign-in
  │
  ├─ (dashboard)/* pages — client components, fetch from /api/*
  │
  └─ /api/* route handlers
      ├─ requireUser()   → Clerk userId → Prisma User lookup/upsert
      ├─ prisma.*        → PostgreSQL via localhost:5432
      └─ /api/ai/*       → ai-core agents → AI provider (Gemini/Anthropic/Groq)
```

### Package dependency graph

```
@secondbrain/web
  ├─ @secondbrain/ai-core   (agents + multi-provider AI)
  ├─ @secondbrain/db        (Prisma client + schema)
  └─ @secondbrain/types     (shared interfaces)

@secondbrain/ai-core
  └─ @anthropic-ai/sdk

@secondbrain/db
  └─ @prisma/client
```

### AI provider selection

The active provider is set by the `AI_PROVIDER` env var (default: `gemini`).  
Each feature has its own model + token budget defined in `packages/ai-core/src/ai-config.ts`.

| Provider   | Env var needed        | Models used (fast / smart)                      |
|------------|----------------------|-------------------------------------------------|
| `gemini`   | `GEMINI_API_KEY`     | gemini-2.5-flash / gemini-2.5-flash             |
| `anthropic`| `ANTHROPIC_API_KEY`  | claude-haiku-4-5 / claude-sonnet-4-6            |
| `groq`     | `GROQ_API_KEY`       | llama-3.1-8b-instant / llama-3.3-70b-versatile  |

Set `MOCK_AI=true` to skip all API calls and return canned responses (useful for UI work without credits).

---

## Database

- **Engine:** PostgreSQL 16 (with pgvector extension, via Docker image `pgvector/pgvector:pg16`)
- **ORM:** Prisma 5 — schema at `packages/db/prisma/schema.prisma`
- **Connection:** `localhost:5432`, database `secondbrain`, user `secondbrain`
- **Schema sync strategy:** `prisma db push` (no migrations directory — pushes schema diff directly)
- **Client regeneration:** required after any schema change — `prisma generate`

### Models

| Model         | Table             | Purpose                          |
|---------------|-------------------|----------------------------------|
| `User`        | `users`           | Synced from Clerk via webhook    |
| `Habit`       | `habits`          | Health module habits             |
| `HabitLog`    | `habit_logs`      | Daily completion records         |
| `Goal`        | `goals`           | Career & Knowledge goals         |
| `Milestone`   | `milestones`      | Sub-tasks under a Goal           |
| `Skill`       | `skills`          | Career & Knowledge skills        |
| `JournalEntry`| `journal_entries` | Journal module events            |
| `AiBriefing`  | `ai_briefings`    | Daily AI briefing cache (1/day)  |

---

## Authentication

- **Provider:** [Clerk](https://clerk.com)
- Every route except `/sign-in`, `/sign-up`, and `/api/webhooks` is protected by `clerkMiddleware` in `src/middleware.ts`.
- `requireUser()` in `src/lib/auth.ts` resolves the Clerk `userId` to a Prisma `User` row, upserting on first sign-in.
- New users are also created via the `/api/webhooks/clerk` route (Clerk webhook `user.created`).
- Relevant env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`.

---

## Deployment & Hosting

The app runs as **two systemd user services** on the host machine (not containerised).  
Service files live at `~/.config/systemd/user/`.

### `secondbrain-web.service`
- Runs `next start -p 3000` with `NODE_ENV=production`
- Working directory: `/home/sanjay/Desktop/secondbrain/apps/web`
- Uses the pre-built `.next` output — **source edits have no effect until you rebuild**
- Auto-restarts on crash (`Restart=always`, `RestartSec=5`)

### `secondbrain-tunnel.service`
- Runs `ngrok http --url=https://colt-tidings-wad.ngrok-free.dev 3000`
- Depends on `secondbrain-web.service` being up first
- Exposes the local :3000 server on the fixed public domain

### Infrastructure diagram

```
Host machine (Ubuntu)
├── Docker: secondbrain-postgres  →  localhost:5432
├── Docker: secondbrain-redis     →  localhost:6379  (reserved, not yet used)
├── systemd: secondbrain-web      →  localhost:3000  (next start)
└── systemd: secondbrain-tunnel   →  colt-tidings-wad.ngrok-free.dev → :3000
```

---

## Environment Variables

Copy `.env.example` → `.env.local` at the repo root and fill in values.  
The web app also reads `apps/web/.env.local` (same keys, Next.js convention).

| Variable                            | Required | Purpose                                      |
|-------------------------------------|----------|----------------------------------------------|
| `DATABASE_URL`                      | ✅       | Postgres connection string                   |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅       | Clerk frontend key                           |
| `CLERK_SECRET_KEY`                  | ✅       | Clerk server key                             |
| `CLERK_WEBHOOK_SECRET`              | ✅       | Validates Clerk webhook payloads             |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | ✅       | `/sign-in`                                   |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`     | ✅       | `/sign-up`                                   |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | ✅    | `/dashboard`                                 |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | ✅    | `/dashboard`                                 |
| `NEXT_PUBLIC_APP_URL`               | ✅       | `http://localhost:3000` or public ngrok URL  |
| `GEMINI_API_KEY`                    | default  | Required when `AI_PROVIDER=gemini` (default) |
| `ANTHROPIC_API_KEY`                 | optional | Required when `AI_PROVIDER=anthropic`        |
| `GROQ_API_KEY`                      | optional | Required when `AI_PROVIDER=groq`             |
| `AI_PROVIDER`                       | optional | `gemini` (default) / `anthropic` / `groq`   |
| `MOCK_AI`                           | optional | `true` → skip all AI calls, return mock data |
| `REDIS_URL`                         | optional | `redis://localhost:6379` (reserved)          |

---

## Build, Start & Stop

### Prerequisites (first-time setup)

```bash
# 1. Install dependencies (Node ≥ 20 required)
pnpm install

# 2. Start the database
docker compose up -d

# 3. Copy and fill env file
cp .env.example .env.local
# edit .env.local with your Clerk keys, AI provider key, etc.

# 4. Push schema and generate Prisma client
cd packages/db
npx prisma db push       # creates all tables
npx prisma generate      # generates the typed client
cd ../..
```

### Development (hot-reload, localhost only)

```bash
# Start all packages in watch mode via Turborepo
pnpm dev
# → web app available at http://localhost:3000

# Or start only the web app
cd apps/web && npx next dev --port 3000
```

### Production build (required before the public site updates)

```bash
cd apps/web
NODE_ENV=production npx next build
# Build output goes to apps/web/.next/
# Typical build time: ~30–60 seconds
```

> **Important:** The live public site (`secondbrain-web.service`) serves the pre-built `.next` output.
> Every time you change source code you must rebuild and restart the service — hot-reload does not apply.

### Start / stop / restart the live site

```bash
# Restart after a new build (most common operation)
systemctl --user restart secondbrain-web.service

# Check status
systemctl --user status secondbrain-web.service
systemctl --user status secondbrain-tunnel.service

# View live logs
journalctl --user -u secondbrain-web.service -f

# Stop the web server (site goes offline; tunnel stays up but returns connection errors)
systemctl --user stop secondbrain-web.service

# Stop the public tunnel (site stays up locally at :3000 but is no longer public)
systemctl --user stop secondbrain-tunnel.service

# Stop both
systemctl --user stop secondbrain-web.service secondbrain-tunnel.service

# Start both
systemctl --user start secondbrain-web.service secondbrain-tunnel.service
```

### Full deploy sequence (code change → live)

```bash
# 1. Make code changes in apps/web/src (or packages/*)

# 2. If schema changed: regenerate Prisma client and push DB
cd packages/db && npx prisma db push && npx prisma generate && cd ../..

# 3. Build
cd apps/web && NODE_ENV=production npx next build && cd ../..

# 4. Restart the service
systemctl --user restart secondbrain-web.service

# 5. Tell browser to hard-refresh (Ctrl+Shift+R) — chunk hashes change each build
```

### Docker (database)

```bash
# Start Postgres + Redis
docker compose up -d

# Stop
docker compose down

# Stop and wipe all data (destructive)
docker compose down -v

# Check container health
docker compose ps
```

### Prisma CLI shortcuts

```bash
# From repo root (uses turbo)
pnpm db:push          # push schema changes to DB (no migration history)
pnpm db:generate      # regenerate Prisma client after schema edits
pnpm db:studio        # open Prisma Studio at http://localhost:5555

# Or directly from packages/db
cd packages/db
npx prisma db push
npx prisma generate
npx prisma studio
```

---

## Development Workflow

### Typecheck

```bash
cd apps/web && npx tsc --noEmit
# or from root:
pnpm type-check
```

### Lint

```bash
pnpm lint
```

### Switching AI provider for development

```bash
# In .env.local:
AI_PROVIDER=anthropic   # use Claude (needs ANTHROPIC_API_KEY)
AI_PROVIDER=gemini      # use Gemini (needs GEMINI_API_KEY) — default
AI_PROVIDER=groq        # use Groq (needs GROQ_API_KEY) — fastest / free tier

# Offline mode — no API key needed, agents return canned responses:
MOCK_AI=true
```

---

## Adding a New Feature Module

Follow this checklist — the Journal module is the canonical example.

1. **DB model** — add to `packages/db/prisma/schema.prisma`, then `prisma db push && prisma generate`
2. **Types** — add interface to `packages/types/src/index.ts`
3. **AI agent** — create `packages/ai-core/src/agents/<feature>-agent.ts`, add to `ai-config.ts` features map, export from `index.ts`
4. **API routes** — create `apps/web/src/app/api/<feature>/route.ts` (CRUD) and `apps/web/src/app/api/ai/<feature>-insight/route.ts`
5. **Page** — create `apps/web/src/app/(dashboard)/<feature>/page.tsx`
6. **Sidebar link** — add nav item to `apps/web/src/components/layout/sidebar.tsx`
7. **Build & deploy** — run the full deploy sequence above

---

## Agentic Development Workflow

For feature work that follows a full product development lifecycle (requirements → planning → implementation → tests → review → PR), use the multi-agent pipeline documented in [AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md).

**Six-agent pipeline:**

| # | Agent | Responsibility | Output |
|---|-------|---------------|--------|
| 1 | PM | Interview → PRD → Jira ticket | `prd.md` + Jira issue |
| 2 | Planner | Codebase analysis → implementation plan | `plan.md` |
| 3 | Dev | Implement changes on feature branch | commits on `feature/SB-<n>-*` |
| 4 | Tester | Write tests for changed code | test files + `test-report.md` |
| 5 | Reviewer | Architect / Security / Perf review + auto-fix MUST issues | `review.md` |
| 6 | PR | Push branch + open GitHub PR | PR URL |

**Prerequisites before running:**
```bash
sudo apt install gh && gh auth login          # GitHub CLI
# Add JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY to .env.local
```

See [AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md) for full agent prompts, file conventions, and the approval-gate protocol.
