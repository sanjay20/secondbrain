# Test Report: SB-39 — Values and Identity

## Run ID: 20260531-1603
## Branch: feature/SB-39-values-identity
## Date: 2026-05-31

---

## Test files added

| File | Cases | Layer |
|------|-------|-------|
| `apps/web/src/__tests__/api/values.test.ts` | 14 | API integration (GET + POST) |
| `apps/web/src/__tests__/api/values-id.test.ts` | 13 | API integration (PATCH + DELETE) |
| `apps/web/src/__tests__/api/journal-agent.test.ts` | 6 | Unit (MOCK_AI=true) |
| **Total** | **33** | |

---

## Infrastructure change

`apps/web/src/__tests__/setup.ts` — added `coreValue` entry (findMany / findFirst / create / update / delete / count) to the Prisma mock, mirroring the existing `bucketListItem` pattern.

---

## What was tested

### `values.test.ts` — `GET /api/vision/values` + `POST /api/vision/values`

**GET:**
- Returns items scoped to authenticated userId.
- Returns empty array when user has no values.
- Applies `take: 7` cap (MAX_CORE_VALUES).

**POST:**
- Creates a value with correct userId, responds 201.
- Persists optional description field.
- Returns 201 when existing count < 7.
- Returns 409 with exact error message `"You've reached the maximum of 7 core values"` when count == 7 (AC-2).
- Does not call `prisma.coreValue.create` when cap is hit.
- Returns 400 on empty name, name > 50 chars, description > 300 chars.
- Accepts name at exactly 50 chars and description at exactly 300 chars (boundary).
- Returns 400 when name is missing.

### `values-id.test.ts` — `PATCH /api/vision/values/[id]` + `DELETE /api/vision/values/[id]`

**PATCH:**
- Updates name; verifies ownership via `findFirst({ where: { id, userId } })` (AC-7).
- Updates description, and both fields simultaneously.
- Returns 404 when item not found.
- Returns 404 when item belongs to a different user (ownership scoping, AC-7).
- Returns 400 on empty name, name > 50 chars, description > 300 chars.
- Accepts name at exactly 50 chars (boundary).

**DELETE:**
- Deletes value scoped to userId; checks ownership via findFirst.
- Returns `{ success: true }` on success.
- Returns 404 when item not found.
- Returns 404 when item belongs to a different user (AC-7).

### `journal-agent.test.ts` — `getJournalFollowups` (MOCK_AI=true)

- Returns a non-empty string with and without coreValues.
- Mock output includes all provided value names when coreValues are present.
- Mock output does not reference "reflecting your core values" when coreValues is empty or omitted.
- Includes mock disclaimer text.

---

## Coverage estimate

| File | Changed lines (approx) | Covered |
|------|------------------------|---------|
| `apps/web/src/app/api/vision/values/route.ts` | ~45 lines | ~95% |
| `apps/web/src/app/api/vision/values/[id]/route.ts` | ~45 lines | ~95% |
| `packages/ai-core/src/agents/journal-agent.ts` (mock path) | ~12 lines (mock + valuesBlock) | ~90% |
| **Estimated overall** | | **~93%** |

---

## Deliberate exclusions

| Excluded | Reason |
|----------|--------|
| `apps/web/src/app/api/ai/journal-insight/route.ts` | This is a wiring route that forwards coreValues to the agent. The agent itself is tested directly (journal-agent.test.ts). Testing the route would require mocking the AI module and Prisma together in a way that adds no unique coverage beyond the two separated layers already tested. Consistent with how other AI insight routes are handled in this project (no standalone test for the route, agent tested in isolation). |
| UI components (`core-value-card.tsx`, `core-value-form.tsx`, `core-values-tab.tsx`, `daily-values-reminder.tsx`) | No component test framework (React Testing Library) is configured; adding it is out of scope for this ticket and would introduce a new dependency. Consistent with the rest of the codebase which has no component tests. |
| `apps/web/src/app/(dashboard)/layout.tsx` and `vision/page.tsx` edits | Pure wiring changes (adding a component mount, adding a tab). No logic to unit-test. |

---

## Route bugs found

None. All routes behaved exactly as specified in the plan and accepted by the tests on the first run.

---

## Result

33 tests, 3 files — all passing.
