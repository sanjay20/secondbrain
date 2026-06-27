# Dev Notes — SB-45 Streak Motivation Nudges

Branch: `feature/SB-45-streak-nudges` (branched from master `9a4f994`).
4 commits, one per logical unit (ai-core agent+config, lib helper, API route, card+page).

## Implementation summary

Followed the plan exactly. All 8 steps implemented mirroring the Goal Conflict / Daily Briefing patterns:

- `packages/ai-core/src/ai-config.ts` — added `"streakNudge"` to the `AIFeature` union and a `streakNudge` FEATURES entry (`MODELS.fast` / `GEMINI_MODELS.fast` / `GROQ_MODELS.fast`, `maxTokens: 400`).
- `packages/ai-core/src/agents/nudge-agent.ts` (new) — inline `NudgeHabit`/`NudgeContext`/`NudgeOutput` types, `getMockNudge`, `fmtHabits`, `generateStreakNudge`. `shouldMockAI()` guard, empty-habits backstop before any LLM call, `getChatConfig("streakNudge")`, defensive JSON parse stripping code fences. On parse failure or empty message → returns `getMockNudge(ctx)` (never throws).
- `packages/ai-core/src/index.ts` — re-exported `generateStreakNudge` + types.
- `apps/web/src/lib/habit-streak.ts` (new) — `findBrokenStreakHabits(prisma, userId, today, tz)`. Single `habit.findMany` (active + `frequency: "daily"`) and a single `habitLog.findMany` over the half-open 2-day window `[yesterday.gte, today.lt)` (no N+1). A habit is broken when it has no `completed:true` log in that window.
- `apps/web/src/app/api/ai/streak-nudge/route.ts` (new) — `requireUser` (401 on throw), detection backstop returns `{hasNudge:false,...}` without AI, `Promise.race` 50s timeout, `maxDuration = 60`. Returns the `NudgeOutput` FLAT. Per NFR-2/AC-7, ANY AI error/timeout returns `{hasNudge:false,message:"",habits:[]}` with HTTP 200 (only auth failure is non-200).
- `apps/web/src/components/dashboard/streak-nudge-card.tsx` (new) — `"use client"`, localStorage daily gate `sb_streak_nudge_dismissed:<YYYY-MM-DD>`, fetch on mount (skipped when today's key present), renders null unless `hasNudge`, "Got it" writes the key. Amber `Flame` motif mirroring goal-conflict-card styling.
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — `<StreakNudgeCard />` rendered directly below `<GoalConflictCard .../>`.

## Decisions / deviations

- **No deviations from the plan.** Types, signatures, response shape, and resilience behaviour all match the plan as written.
- Typed the `prisma` param in `habit-streak.ts` as `PrismaClient` (from `@prisma/client`) for type safety — matches how `@/lib/db` constructs the client.
- Removed an unused intermediate `EMPTY` const from the agent during cleanup; the route keeps a local `NO_NUDGE` constant for its 200-fallback.

## Typecheck

`cd apps/web && npx tsc --noEmit` reports exactly ONE error, and it is **pre-existing on master** (verified by checking out master and re-running): `src/__tests__/lib/monthly-score.test.ts(67,54)` — a `LifePillar` type mismatch in an unrelated existing test file. It is NOT introduced by SB-45 and is in a test file outside Dev Agent scope (Test Agent owns test files). **Zero type errors originate from any SB-45 file.** Flagged here for the Test/Review agents.

## DB / deps

No schema change, no `prisma db push`, no new packages (per NFR-3).
