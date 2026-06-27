# Plan: Monthly Life Score (SB-44)

## Context

**Why:** Users log data across six life pillars (career, wealth, health, knowledge, relationships, personal) but have no unified view of how they're doing across all of them. SB-44 (epic SB-40) asks for an AI feature that scores each pillar **1–10 per calendar month** from the user's real data, with a short explanation, a **trend vs. the prior month**, and a **radar/spider chart** for at-a-glance balance.

**Outcome:** A new on-demand AI feature that mirrors the existing Weekly Review / Goal Conflict pattern end-to-end: AI agent → ai-config entry → persisted Prisma model → authenticated API route → dashboard card with a recharts radar chart and month selector. Approved PRD assumptions: default to **current month**; **upsert** (one score per user/month, regenerate overwrites); card placed **below Goal Conflict**; relationships/personal pillars send **aggregate metadata only** (no raw journal text).

This follows the exact conventions traced in the codebase — closest template is **Weekly Review** (button-driven, persisted per period, `content` Json, dashboard seeds latest from server). Models: `MODELS.powerful` = `claude-opus-4-8` (NFR-2, Opus trial).

## Design summary

- **One batch AI call** scores all six pillars (NFR-1), returning `{ pillar, score (1–10), explanation }[]`.
- **Trend is computed in the route, not by the AI** — load the prior month's stored row and diff scores. Keeps stored data clean and trends always correct (AC-3/AC-4).
- **Activity pillars** (health, parts of wealth/career, relationships) filter logs by month range; **state pillars** (net worth, goals, skills, savings standing) use the current snapshot. Documented in the agent prompt so scores are interpretable.
- **Persistence keyed by `(userId, year, month)`**, upsert — regenerate overwrites (OQ-2). Past months are read back without re-calling AI (AC-8).
- **Privacy (OQ-4):** only counts/aggregates/sentiment-tag tallies go to the AI, never raw journal/gratitude text.

## Affected files

| File | Change | Notes |
|------|--------|-------|
| `packages/db/prisma/schema.prisma` | Add `MonthlyLifeScore` model + User back-relation | unique `[userId, year, month]` |
| `packages/ai-core/src/agents/monthly-life-score-agent.ts` | **New** agent | mirror `weekly-review-agent.ts` exactly |
| `packages/ai-core/src/ai-config.ts` | Add `"monthlyLifeScore"` to `AIFeature` union + `FEATURES` map | `anthropic: MODELS.powerful`, `maxTokens: ~1200` |
| `packages/ai-core/src/index.ts` | Re-export agent fn + types | match existing export lines |
| `apps/web/src/lib/datetime.ts` | Add `monthRange(date, tz)` helper | mirror `weekRange`; returns `{ gte, lt }` |
| `apps/web/src/app/api/ai/monthly-life-score/route.ts` | **New** route: `POST` (generate) + `GET` (read stored month) | auth, data aggregation, trend calc, upsert |
| `apps/web/src/components/dashboard/monthly-life-score-card.tsx` | **New** client card | recharts `RadarChart` + scores list + trend arrows + month selector + states |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Load latest `monthlyLifeScore` in `Promise.all`; render card below `GoalConflictCard` | seed `initialScore` |
| `apps/web/src/__tests__/setup.ts` | Add `monthlyLifeScore` to prisma mock map | findUnique/findFirst/findMany/upsert |
| Tests (3 new files) | agent unit, route integration, card smoke | see Test strategy |

## Implementation steps

1. **DB model** — add to `schema.prisma`:
   ```prisma
   model MonthlyLifeScore {
     id        String   @id @default(cuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     year      Int
     month     Int      // 1–12
     content   Json     // { scores: [{ pillar, score, explanation }] }
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     @@unique([userId, year, month])
     @@index([userId])
     @@map("monthly_life_scores")
   }
   ```
   Add `monthlyLifeScores MonthlyLifeScore[]` to `User`. Then `pnpm db:generate` + `cd packages/db && pnpm prisma db push` (additive, no data loss).

2. **Agent** (`monthly-life-score-agent.ts`) — copy the structure of `weekly-review-agent.ts`:
   - Inline `MonthlyLifeScoreContext` (per-pillar aggregate fields: e.g. `health: { habitCompletionPct, workoutCount, workoutMinutes, avgMood }`, `wealth: { netWorthPaise, income, expense, savingsProgressPct, investmentCount }`, etc.) and `monthLabel: string`, `userName: string`.
   - Output `MonthlyLifeScoreOutput = { scores: Array<{ pillar: Pillar-string; score: number; explanation: string }> }`.
   - `shouldMockAI()` → deterministic mock scoring from signal counts (so tests run offline). Sanitise: clamp score to 1–10 integer, ensure all 6 pillars present (fill missing with a low default + "insufficient data" note → satisfies NFR-4/AC-6), trim explanations. Defensive JSON parse + mock fallback, identical to weekly-review.
   - Single batched prompt listing each pillar's aggregates; instruct strict JSON, 2–4 sentence explanations, score sparse pillars low rather than erroring.

3. **ai-config + index** — add `monthlyLifeScore` feature entry and re-export `generateMonthlyLifeScore` + its types.

4. **`monthRange` helper** in `datetime.ts` — tz-aware calendar-month `{ gte, lt }`, mirroring `weekRange`.

5. **Route** (`/api/ai/monthly-life-score/route.ts`), `maxDuration = 60`:
   - `POST` body `{ year?, month? }` (default current month via `getTodayDate`): `requireUser()` (401 on throw); aggregate all pillar data with `prisma.*` queries scoped by `userId` and `monthRange` (activity logs) / current snapshot (state); call agent inside the `Promise.race` 50s timeout pattern (504 on timeout); load prior month row to compute per-pillar `{ delta, direction }`; `upsert` by `userId_year_month`; respond `{ score: { year, month, scores, trend }, cached: false }`.
   - `GET ?year=&month=` → return stored row + computed trend without calling AI (AC-8); 404/empty shape if none.
   - Error → `aiErrorMessage(err)` 500, matching goal-conflict.

6. **Card** (`monthly-life-score-card.tsx`, `"use client"`) — props `{ initialScore }`:
   - Recharts `RadarChart`/`Radar`/`PolarGrid`/`PolarAngleAxis`/`PolarRadiusAxis` (domain 0–10), data built from scores using `PILLAR_META` labels/colors from `apps/web/src/lib/pillars.ts`.
   - Per-pillar list: label, score, trend arrow + delta (or "No previous data" — AC-4), explanation.
   - Month `<select>` (current + up to 11 back) → calls `GET` to switch stored months without AI (AC-8/FR-9).
   - "Generate Monthly Score" button → `POST`; loading skeleton; error toast (FR-10). Empty state when `initialScore` null.
   - Accessible fallback table (pillar/score/trend) for the chart (NFR-5).

7. **Dashboard wiring** — add `prisma.monthlyLifeScore.findFirst({ where: { userId }, orderBy: [{ year: "desc" }, { month: "desc" }] })` to the `Promise.all` in `getDashboardData()`; pass `initialScore`; render `<MonthlyLifeScoreCard …/>` directly **below** `<GoalConflictCard/>`.

## DB changes required?

Yes — new `MonthlyLifeScore` table. Additive only. Sync via `prisma db push` (no migrations dir), then `prisma generate`. No `--accept-data-loss`.

## New packages required?

None. **recharts ^2.13.0** already in `apps/web/package.json` and supports `RadarChart` (example usage: `apps/web/src/components/mindset/mood-chart.tsx`).

## Test strategy

Vitest runs in **node env** (no jsdom) — tests validate logic, not DOM (per existing `weekly-review-card.test.ts`). Add `monthlyLifeScore` to the prisma mock in `src/__tests__/setup.ts`.

- **Agent unit** (`MOCK_AI=true`, like `briefing-agent.test.ts`): all 6 pillars returned, scores clamped 1–10, sparse-data pillar still scored (AC-6/NFR-4), no `undefined`/`NaN`.
- **Route integration** (mocked prisma/auth, like `mood.test.ts`): 401 unauth (AC-9); POST persists via `upsert` with `userId_year_month`; trend computed vs prior-month row (AC-3) and "No previous data" when absent (AC-4); GET returns stored month without invoking the agent (AC-8); userId scoping on every query (NFR-3); 504 on timeout.
- **Card smoke**: radar-data builder maps 6 pillars to chart shape with correct labels/colors; trend-arrow helper returns up/down/flat + delta; empty-state predicate when `initialScore` null.

## Risk / unknowns

- **Per-model date semantics** differ (activity `date`/`completedAt` vs. state `createdAt`). Mitigation: month-filter activity logs; use current snapshot for standing/state pillars — documented in the agent prompt so the score is interpretable.
- **`SkillGoal` has no direct `userId`** — query via `Skill`/`Goal` relations if used; otherwise rely on `Skill.level`/count for knowledge.
- **`Goal.area`** only uses `career`/`knowledge` today; map goal areas into pillars defensively (don't assume all 6 present).
- Opus latency — covered by the 50s race + 60s `maxDuration` (same as goal-conflict, already proven this session).

## Estimated size

**L** — new DB model + AI agent + dual-method API route + charting card + dashboard wiring + 3 test files.

## Verification (end-to-end)

1. `pnpm db:generate && (cd packages/db && pnpm prisma db push)` — table created, no data loss.
2. `cd apps/web && npx tsc --noEmit` — passes.
3. `cd apps/web && pnpm vitest run src/__tests__/api/monthly-life-score* src/__tests__/components/monthly-life-score*` — all green.
4. `pnpm build` then `systemctl --user restart secondbrain-web.service`; on the dashboard click **Generate Monthly Score** → 6 pillar scores + explanations + radar render (AC-1/AC-2/AC-5); re-load shows persisted (AC-7); switch month selector shows stored month without spinner/AI (AC-8); first-ever run shows "No previous data" (AC-4).

## Pipeline execution note

This plan stands in for the run-workflow **Planner** step (plan gate). On approval I will: copy this into `.claude/workflow/20260627-1102/plan.md`, write the planner `handoff.json` (`next_agent: "dev"`), then auto-run **Dev → Test → Review → PR** per `.claude/AGENTIC_WORKFLOW.md` (branch `feature/SB-44-monthly-life-score`, no further gates; PR opened at the end).
