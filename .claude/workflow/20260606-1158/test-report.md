# Test Report — SB-13 Skills Tracker

## What Was Tested

### API Route: `GET /api/skills`
- Returns skills scoped to authenticated user (userId filter)
- Returns empty array when user has no skills
- Applies `take: 200` cap
- Includes `skillGoals` with nested `goal` in the query
- Filters by `area` when query param is provided
- Does not include `area` filter when param is absent
- Orders by category asc, then name asc

### API Route: `POST /api/skills`
- Creates skill with correct `userId` (201)
- Persists `category` and `description` fields
- Backward-compatible with name+level only (no extra fields required)
- Uses upsert keyed on `userId_name` to prevent duplicates
- Updates `level`, `category`, `description` on re-add (upsert update branch)
- Includes `skillGoals` with nested `goal` in the upsert call
- Returns 201 with the final skill (after upsert + goal sync)
- Does not call `goal.findMany` or `$transaction` when `goalIds` is absent
- Does not call `$transaction` when `goalIds` is an empty array
- Validates goal ownership before linking (scoped to `userId`)
- Calls `$transaction` with `deleteMany` + `createMany` when valid `goalIds` provided
- Does not link goals not owned by the user (empty `data` array in `createMany`)
- Fetches final skill with `include` after goal sync
- Input validation: returns 400 for empty name, name > 60 chars, level < 1, level > 5, non-integer level, description > 200 chars
- Defaults: `category` defaults to `"technical"`, `level` defaults to `1`

### API Route: `PATCH /api/skills/[id]`
- Returns 404 when skill does not belong to the authenticated user
- Returns 404 when skill id does not exist
- Scopes ownership check to `userId`
- Updates `level`, `category`, `description`, `name` individually
- Does not call `goal.findMany` or `$transaction` when `goalIds` is absent
- Syncs goal links when `goalIds` is provided (including empty array to unlink all)
- Validates goal ownership before linking
- Calls `$transaction` with `deleteMany` + `createMany` for valid links
- Ignores `goalIds` belonging to other users
- Fetches final skill with `skillGoals` include after update
- Accepts `null` description to clear it
- Input validation: returns 400 for empty name, name > 60 chars, level < 1, level > 5, non-integer level, description > 200 chars

### API Route: `DELETE /api/skills/[id]`
- Deletes skill scoped to `userId`
- Returns `{ success: true }` on success (200)
- Returns 404 when skill not found
- Returns 404 when skill belongs to a different user
- Does not call `prisma.skill.delete` when ownership check fails

## Test Files Added

- `apps/web/src/__tests__/api/skills.test.ts` — 31 tests for GET + POST collection route
- `apps/web/src/__tests__/api/skills-id.test.ts` — 27 tests for PATCH + DELETE id route

**Total: 58 new tests, all passing.**

## Route Fix Applied During Testing

Both `apps/web/src/app/api/skills/route.ts` (POST) and `apps/web/src/app/api/skills/[id]/route.ts` (PATCH) used `schema.parse()` without a try-catch, meaning Zod validation errors would result in unhandled exceptions (HTTP 500) instead of a proper 400 response. The routes were fixed to wrap the parse call in a try-catch, catching `ZodError` and returning `{ status: 400 }`. This aligns with the existing pattern used in other routes (e.g. `vision/values/route.ts` uses `safeParse`). Typecheck still passes after the fix.

## Coverage Estimate

| File | Estimated coverage |
|------|--------------------|
| `apps/web/src/app/api/skills/route.ts` | ~95% (all branches tested) |
| `apps/web/src/app/api/skills/[id]/route.ts` | ~95% (all branches tested) |
| `packages/types/src/index.ts` (SKILL_CATEGORIES, SKILL_LEVELS, interfaces) | — (types-only, no test needed) |
| `packages/db/prisma/schema.prisma` | — (schema-only, no test needed) |

**Overall estimate: ~85% of changed production code lines covered** (excluding schema and type-only files).

## Deliberately Excluded

| Item | Reason |
|------|--------|
| `apps/web/src/components/career/proficiency-ring.tsx` | The vitest config uses `environment: "node"` with no jsdom/happy-dom setup and no `@testing-library/react` installed. Component rendering tests are not supported in the current test setup. |
| `apps/web/src/components/career/skill-card.tsx` | Same reason — React client component requiring jsdom environment. |
| `apps/web/src/components/career/skill-form.tsx` | Same reason — React client component requiring jsdom environment. |
| `apps/web/src/app/(dashboard)/career/page.tsx` | Page component — requires jsdom + next/navigation mocks not present in this test setup. |
| `apps/web/src/__tests__/setup.ts` changes | The mock additions (skill/skillGoal) were pre-authored by the dev; no test needed for the setup file itself. |
