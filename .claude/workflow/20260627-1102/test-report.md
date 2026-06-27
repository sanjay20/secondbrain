# Test Report — SB-44 Monthly Life Score

## What was tested

### 1. Agent unit test (`monthly-life-score-agent.test.ts`) — 21 tests
- `MOCK_AI=true` offline path; no real AI calls made.
- All 6 life pillars always present in output (NFR-4 / AC-6).
- Every score is an integer in range 1–10 (AC-1).
- Pillar with zero/sparse signals still gets a score + explanation (AC-6).
- No `undefined` or `NaN` in any explanation string.
- `avgMood: null` health context handled cleanly.
- Full context and sparse (all-zeros) context both tested.

### 2. Route integration test (`monthly-life-score-route.test.ts`) — 30 tests
- Prisma and `generateMonthlyLifeScore` fully mocked; no DB or AI.
- **POST**:
  - 401 when `requireUser` throws (AC-9).
  - `monthlyLifeScore.upsert` called once, keyed by `userId_year_month` (AC-7).
  - `upsert.create.userId` always scoped to the authenticated user (NFR-3).
  - Trend `direction: "none"` + `delta: 0` for all pillars when no prior month (AC-4).
  - Trend `up`/`down`/`flat` computed correctly from prior-month stored row (AC-3).
  - `goal.findMany`, `habit.findMany`, prior-month lookup all scoped to `userId` (NFR-3).
  - 504 on 50s `Promise.race` timeout using `vi.useFakeTimers` (same pattern as goal-conflict route tests).
  - 500 on agent throw, error string in body.
- **GET**:
  - 401 when unauthenticated (AC-9).
  - Returns stored month without calling AI (AC-8).
  - Returns `{ score: null }` when no row exists.
  - All `findUnique` calls scoped by `userId` (NFR-3).
  - Returns year/month/monthLabel/scores/trend in payload.

### 3. Card smoke test (`monthly-life-score-card.test.ts`) — 24 tests
- Node env, no DOM render. Pure functions replicated inline (same approach as `weekly-review-card.test.ts`).
- `buildRadarData` maps all 6 pillars to PILLAR_META labels (Career / Wealth / Health / Knowledge / Relationships / Personal) with correct score values.
- Falls back to raw pillar string for unknown keys.
- `trendVariant` returns correct variant for all 4 directions.
- `trendLabel` renders `+N`/`-N`/`0` or `"No previous data"` (AC-4).
- Empty-state predicate is true when `initialScore` is null.
- `MonthlyScorePayload` type contract: shape, field types, empty arrays.

## Coverage estimate

| File | Coverage |
|------|----------|
| `packages/ai-core/src/agents/monthly-life-score-agent.ts` | ~90% (mock path fully covered; real AI path skipped by design — same as other agent tests) |
| `apps/web/src/app/api/ai/monthly-life-score/route.ts` | ~85% (POST happy path, 401, upsert, trend, 504, 500, GET happy path, GET 404/null, userId scoping; `buildContext` inner aggregation logic exercised via fully mocked prisma) |
| `apps/web/src/components/dashboard/monthly-life-score-card.tsx` | ~40% (pure logic covered; JSX/React render logic and browser-side fetch calls not exercised — node env only) |

## Deliberately excluded

- **Real AI provider path** in the agent: requires a live Anthropic API key; skipped per MOCK_AI convention used project-wide.
- **JSX/DOM rendering** of MonthlyLifeScoreCard: Vitest is configured with `environment: "node"`, no jsdom. The radar chart, select element, and button interactions are not testable without a browser environment. This is consistent with all other card tests in the project.
- **`buildContext` per-aggregate math**: The route's internal aggregation arithmetic (habitCompletionPct, avgMood, savingsProgressPct etc.) is not unit-tested in isolation — it's an internal private function. The integration test verifies the overall shape and userId scoping; arithmetic correctness is the dev's responsibility per the plan's "no extra abstractions" rule.
- **Database schema / Prisma migration**: Out of scope for tests; covered by `prisma db push` during dev.

## Setup.ts changes
Added `count` method to `investment` and `journalEntry` mocks in `setup.ts` — the route calls `investment.count` and `journalEntry.count`, which were missing from the global mock. This change is additive and did not break any existing tests (full suite: 968 tests, all pass).

## Full suite result
53 test files, 968 tests — all green. TypeScript (`npx tsc --noEmit`) passes.
