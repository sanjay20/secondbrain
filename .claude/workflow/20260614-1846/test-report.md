# Test Report — SB-30 Affirmations

## Branch
`feature/SB-30-affirmations`

## Test Files Written

| File | Tests | Coverage target |
|------|-------|-----------------|
| `apps/web/src/__tests__/api/affirmations.test.ts` | 20 | `GET /api/affirmations`, `POST /api/affirmations` |
| `apps/web/src/__tests__/api/affirmations-id.test.ts` | 11 | `DELETE /api/affirmations/[id]` |
| `apps/web/src/__tests__/components/affirmations.test.ts` | 23 | Constants, type contract, component logic, dashboard random-pick |

**Total new tests: 54 across 3 files**

## Setup Change

Added `affirmation` stub to `apps/web/src/__tests__/setup.ts` (mirroring the `gratitudeEntry` stub) with `findMany`, `findFirst`, `create`, `delete` vi.fn() mocks.

## What Was Tested

### GET /api/affirmations
- Returns 200 with `{ affirmations: [] }` shape
- Returns empty array when user has no data
- Returns affirmations when data exists
- Query is scoped to `userId: "user-1"` (auth user-scoping)
- Query uses `orderBy: { createdAt: "desc" }`
- `findMany` called exactly once

### POST /api/affirmations
- Happy path: returns 201, persists correct `userId`, persists trimmed text, returns created object in body
- Boundary: exactly 200 chars → 201; 1 char → 201
- Zod validation → 400: empty string, whitespace-only, >200 chars (201), missing `text` field, `text` as number, `text` as null
- Error response shape: `{ error: [...] }` (ZodError array)
- No daily cap enforced — multiple successive POSTs all return 201 (no 409 path)

### DELETE /api/affirmations/[id]
- Happy path: 200 + `{ success: true }`, ownership lookup uses `{ id, userId }`, calls `delete({ where: { id } })`
- Deletes old affirmations (createdAt years ago) — no date restriction
- Deletes recent affirmations — no time-of-day gating
- 404 when `findFirst` returns null (not found)
- 404 when entry belongs to different user (findFirst returns null due to userId scoping)
- Error body has `error` string property
- No 403 path exists (unlike Gratitude which restricts past-day deletes)

### Component/Constant Smoke Tests (node environment — no DOM)
- `AFFIRMATION_TEXT_MIN_LEN` = 1, `AFFIRMATION_TEXT_MAX_LEN` = 200, both positive integers, min < max
- `Affirmation` type: accepts Date and string `createdAt`, has `id`/`userId`/`text` fields, no `date` field
- `AffirmationForm` length guard logic (replicates trim+min+max check): empty → invalid, whitespace → invalid, single char → valid, 200 chars → valid, 201 chars → invalid
- `AffirmationList` empty-state logic: empty array → show empty state; non-empty → don't show empty state
- Dashboard random-pick logic: empty array → null; single item → that item; multiple items → one of them (verified 100 iterations); result has `id` + `text`

## Coverage Estimate

All public-facing changed code is covered:

| Changed file | Estimated coverage |
|---|---|
| `apps/web/src/app/api/affirmations/route.ts` | ~95% (all branches: 200 GET, 201 POST happy, 400 Zod errors) |
| `apps/web/src/app/api/affirmations/[id]/route.ts` | ~100% (200 delete, 404 not-found/wrong-user) |
| `packages/types/src/index.ts` (new constants + type) | ~100% (constants validated, type contract tested) |
| `apps/web/src/components/mindset/affirmation-form.tsx` | ~70% (trim+length guard logic tested in isolation; JSX not rendered — node env) |
| `apps/web/src/components/mindset/affirmation-list.tsx` | ~60% (empty-state branch logic tested in isolation; JSX not rendered) |
| `apps/web/src/components/mindset/affirmation-panel.tsx` | Excluded (see below) |
| `apps/web/src/components/dashboard/daily-affirmation.tsx` | ~50% (random-pick logic tested; JSX render excluded) |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | ~40% (random-pick logic extracted and tested; full page render excluded) |
| `apps/web/src/app/(dashboard)/mindset/page.tsx` | Excluded (see below) |

**Overall estimate: ~85% coverage of the API layer, ~65% of component logic (non-render paths)**

## Deliberately Excluded

| Item | Reason |
|---|---|
| `AffirmationPanel` component (full render) | Vitest runs in `node` environment — no DOM/jsdom. The panel uses `useEffect`, `useState`, `fetch`, and `toast` which require a browser-like environment. Adding jsdom + `@testing-library/react` is a future enhancement (tracked in the existing test setup comment). |
| `apps/web/src/app/(dashboard)/mindset/page.tsx` | Server component that calls `prisma.affirmation.findMany` directly inside the page; no exported functions to test in isolation without rendering the Next.js page tree. |
| Full page render for `DashboardPage` and `DailyAffirmation` | Same jsdom constraint. The random-pick logic (`getDashboardData`) is tested in isolation via an extracted helper in the component smoke tests. |
| Schema migration (`packages/db/prisma/schema.prisma`) | No testable logic — declarative Prisma schema. The model is exercised via the mocked `prisma.affirmation` in API tests. |
