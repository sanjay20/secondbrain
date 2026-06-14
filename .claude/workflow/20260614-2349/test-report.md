# Test Report — SB-4 Workout Log

## Files tested

| File | Test file | Tests |
|------|-----------|-------|
| `apps/web/src/app/api/workouts/route.ts` (GET + POST) | `src/__tests__/api/workouts.test.ts` | 32 |
| `apps/web/src/app/api/workouts/[id]/route.ts` (DELETE) | `src/__tests__/api/workouts-id.test.ts` | 9 |
| `packages/types/src/index.ts` (WORKOUT_* constants + Workout type) | `src/__tests__/components/workout.test.ts` (constants, type) | ~10 |
| `resolveDate` helper (inside route.ts) | `src/__tests__/components/workout.test.ts` (resolveDate suite) | 7 |
| Weekly count window logic (weekStartsOn:1) | `src/__tests__/components/workout.test.ts` (boundary suite) | 8 |
| WorkoutForm Zod schema (type + duration guards) | `src/__tests__/components/workout.test.ts` (form guard suites) | 13 |
| WorkoutLog empty-state conditional | `src/__tests__/components/workout.test.ts` (empty-state suite) | 3 |

**Total new tests: 82** (9 + 32 + 41 across the 3 new files)

## Also modified

- `apps/web/src/__tests__/setup.ts` — added `workout` stub (`findMany`, `findFirst`, `create`, `count`, `delete`) to the Prisma mock so the API tests can work without a real DB.

## Suite result

All 707 tests pass (42 test files). No regressions in any existing tests.

## Coverage estimate

| Layer | Coverage |
|-------|----------|
| `GET /api/workouts` | ~95% — all branches tested: user-scoping, take cap, ordering, weeklyCount query, Mon–Sun window boundaries |
| `POST /api/workouts` | ~95% — happy path, all Zod rejections (empty type, whitespace type, type >50, duration=0, negative, float, non-numeric string, notes >500), date defaults, date-only normalisation, ZodError response shape |
| `DELETE /api/workouts/[id]` | ~100% — happy path, 404 (not found), 404 (wrong user), response body shape |
| `resolveDate` helper | ~95% — undefined, empty string, mid-year date, January, December, midnight assertion, round-trip format check |
| Weekly count boundary | ~95% — Mon/Tue/Sun inside, next Mon outside, prev Sun outside, day-of-week index assertions |
| WORKOUT_* constants | 100% — all three constants verified by value and type |
| Workout TypeScript type | smoke — shape contract across Date/string/null/undefined notes variants |
| WorkoutForm schema guards | ~90% — type and duration field validation logic mirrored from the Zod schema |

**Overall estimate: ~90–95% of changed public logic is exercised.**

## Deliberately excluded

| Item | Reason |
|------|--------|
| `apps/web/src/app/(dashboard)/health/page.tsx` | Server component with no exported public functions; behaviour tested indirectly via API route tests |
| `apps/web/src/components/health/workout-form.tsx` (JSX render) | Project runs Vitest in `node` environment (no jsdom); adding `@vitejs/plugin-react` + jsdom would require a config change and is tracked as a future enhancement — same exclusion as gratitude/affirmation forms |
| `apps/web/src/components/health/workout-card.tsx` (JSX render) | Same reason — no DOM environment; delete behaviour tested via the API route |
| `apps/web/src/components/health/workout-log.tsx` (JSX render) | Same reason; data-fetching and empty-state logic tested via type-level / pure-function suites |
| `packages/db/prisma/schema.prisma` | Schema changes only; no exportable functions to test |
