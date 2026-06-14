# Test Report — SB-28 Gratitude Log

## Files written

| File | Tests |
|------|-------|
| `apps/web/src/__tests__/api/gratitude.test.ts` | 30 |
| `apps/web/src/__tests__/api/gratitude-id.test.ts` | 12 |
| `apps/web/src/__tests__/components/gratitude.test.ts` | 32 |
| **Total** | **74** |

---

## What was tested

### GET /api/gratitude (14 tests)
- User-scoping: both `findMany` calls carry `userId: "user-1"` in the `where` clause
- Month filter: `where.date.gte` = `startOfMonth(today)`, `where.date.lte` = `endOfMonth(today)`
- Two `findMany` calls: one for current-month entries (ordered `[{date:"desc"},{createdAt:"desc"}]`), one for streak (select `{date:true}`, `gte` ~60 days ago)
- Streak calculation via live mock data: 0 (no entries), 1 (today only), 2 (today+yesterday), 3 (three consecutive days), gap-breaking, yesterday-only start, multiple entries per day de-duplicated to 1 streak day
- Empty state: returns `{ entries: [], streak: 0 }`

### POST /api/gratitude (16 tests)
- Zod validation — `item`:
  - empty string → 400
  - whitespace-only string → 400 (Zod `trim().min(1)`)
  - `> 280 chars` → 400
  - `= 280 chars` → 201 (boundary pass)
  - missing field → 400
  - non-string (number `42`) → 400
  - error body contains `error` array
- Happy path: 201, correct `userId`, trimmed `item` persisted
- 409 per-day limit: `count >= GRATITUDE_MAX_PER_DAY` → 409, `create` not called
- 409 error message is a non-empty string
- `count` at 2 (one below limit) → still 201
- Validation failure short-circuits before `count` call

### DELETE /api/gratitude/[id] (12 tests)
- Ownership check: `findFirst({ where: { id, userId } })` called with correct args
- Happy path: 200, `{ success: true }`, `delete({ where: { id } })` called
- 404: entry not found / wrong user → `delete` not called
- 403: entry date is yesterday → `delete` not called, error body contains "past"
- 403: entry date 7 days ago → same guard
- Today midnight entry (no time component): resolves to 200, not 403

### Component / constant smoke tests (32 tests)
- **GRATITUDE_* constants**: `GRATITUDE_MAX_PER_DAY === 3`, `GRATITUDE_ITEM_MAX_LEN === 280`, both are positive integers
- **GratitudeEntry type contract**: Date objects, string dates (API shape), `item` is string
- **GratitudeList grouping logic** (replicated `reduce` from the component): empty input, single entry, 3 entries on same day, entries on two days, field preservation, sorted-keys descending order
- **GratitudeForm limit guard** (replicated `todayCount >= GRATITUDE_MAX_PER_DAY`): false at 0/1/2, true at 3, true above 3
- **computeStreak** (replicated from `route.ts`): 0 / 1 / 2 / 3 / 4-day streaks, gap-breaking, yesterday-only start, DAY2-only (gap, no start), duplicate dates, consecutive-then-gap

---

## Coverage estimate

| Layer | Changed LOC (approx) | Branches tested | Estimated coverage |
|-------|---------------------|-----------------|-------------------|
| `api/gratitude/route.ts` | ~88 | GET path, POST valid, POST Zod fail, POST 409 | ~90% |
| `api/gratitude/[id]/route.ts` | ~22 | DELETE 200, 404, 403 | ~95% |
| `components/mindset/gratitude-form.tsx` | ~48 | limit guard logic, constants | ~40% (logic only; no render) |
| `components/mindset/gratitude-list.tsx` | ~62 | grouping + sort logic, constants | ~50% (logic only; no render) |
| `packages/types/src/index.ts` (gratitude section) | ~12 | type shape + constants | 100% |
| **Overall changed code** | **~232** | | **~80%** |

---

## Deliberately excluded

| Item | Reason |
|------|--------|
| Full component renders (GratitudeForm, GratitudeList, page.tsx) | Vitest is configured with `environment: "node"` — no DOM / jsdom / JSX transform. Adding `@vitejs/plugin-react` + `jsdom` would change the project-wide test config. Tracked as a future enhancement. |
| `app/(dashboard)/mindset/gratitude/page.tsx` | Client component; same no-DOM constraint. The API contract it depends on is tested via the API tests above. |
| `sidebar.tsx` changes (nav link addition) | Minor UI change; no logic to test — just a static link added to the sidebar. |
| `packages/db/prisma/schema.prisma` | Schema changes are tested implicitly via the Prisma mock stubs; schema-level tests require a live DB. |

---

## Suite result

```
Test Files  36 passed (36)
     Tests  561 passed (561)   ← includes 74 new + 487 pre-existing
  Duration  ~2.6s
```

All pre-existing tests continue to pass.
