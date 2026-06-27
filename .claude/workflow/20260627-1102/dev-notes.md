# Dev Notes — SB-44 Monthly Life Score

Implementation follows the plan exactly. Decisions / clarifications made where the
plan left aggregation details to dev judgment:

## Pillar aggregation field mappings (route `buildContext`)
- **career**: `activeGoals`, `completedGoalsThisMonth` (Goal.status=completed AND
  completedAt in month), `milestonesCompletedThisMonth` (Milestone.completed +
  completedAt in month, scoped via `goal.userId`), `avgGoalProgressPct` (mean
  progress of active goals — current snapshot).
- **wealth**: `incomePaise` / `expensePaise` summed from Transaction.type in the
  month window; `netCashflowPaise = income − expense`; `investmentCount` (current
  Investment count); `savingsProgressPct` = avg `min(1, current/target)` across
  SavingsGoals (current standing).
- **health**: `habitCompletionPct = completed habit logs / (active habits × days in
  month window)`, capped 100%; `workoutCount` / `workoutMinutes` from Workout in
  window; `avgMood` = mean MoodLog.mood (1–5) in window, `null` if none.
- **knowledge**: `skillCount`, `avgSkillLevel` (mean Skill.level, current snapshot);
  `notesLoggedThisMonth` = JournalEntry where `category="knowledge"` in window.
- **relationships**: aggregate counts only (privacy) — JournalEntry
  `category="relationships"` count + gratitude count in window. No raw text sent.
- **personal**: total JournalEntry count, MoodLog count (check-ins), Affirmation
  count (current), gratitude count in window.

Note: `gratitudeEntriesThisMonth` is surfaced under both relationships and personal
(it is a single monthly count, reused as a signal for both pillars).

## Trend
Computed in-route (and re-computed in the dashboard seed) by diffing the current
month's stored scores against the **prior calendar month's** stored row. Direction
is `up`/`down`/`flat` when prior data exists, `none` ("No previous data") when it
does not (AC-4). Prior month handles Jan→Dec year rollover.

## Persistence
`MonthlyLifeScore` keyed `@@unique([userId, year, month])`; `content` Json holds
`{ scores: [{ pillar, score, explanation }] }` only. Trend is **not** stored — it is
always derived so it can never drift. POST upserts (regenerate overwrites, OQ-2).

## Agent
Mirrors `weekly-review-agent.ts`: inline types, `shouldMockAI()` deterministic mock
(score derived from a per-pillar signal count via log2 scaling), defensive JSON
parse with mock fallback, `normalizeScores` guarantees all 6 pillars in canonical
order (missing → low "insufficient data" score, AC-6/NFR-4), scores clamped to
integer 1–10. `monthlyLifeScore` feature uses `MODELS.powerful` (Opus), maxTokens
1200.

## Dashboard seeding
`getDashboardData()` loads the latest `monthlyLifeScore` row in the existing
`Promise.all`, then fetches the prior month and builds the full `MonthlyScorePayload`
(scores + trend) server-side so the card renders without an extra client fetch.

## Timeout
Route uses the goal-conflict 50s `Promise.race` + `maxDuration = 60` pattern → 504
on timeout. Json field cast via `as unknown as Prisma.InputJsonValue`.

## Not done (by design)
The 3 test files are the Test Agent's responsibility. The `monthlyLifeScore` prisma
mock entry in `setup.ts` WAS added (implementation scaffolding the route/agent need).
