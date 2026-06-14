# Implementation Plan: SB-28 — Gratitude Log

Mirrors the SB-29 Mood Tracker pattern (PR #11): DB model → type → API → page/components → sidebar → tests.
Key difference: gratitude stores **multiple rows per day** (1–3 items) instead of one upserted row, and adds a **streak counter** plus a **monthly summary**.

## Affected files

| File | Change type | Notes |
|------|-------------|-------|
| `packages/db/prisma/schema.prisma` | Modify | Add `GratitudeEntry` model + `gratitudeEntries GratitudeEntry[]` relation on `User`. Then `prisma db push && prisma generate`. |
| `packages/types/src/index.ts` | Modify | Add `GratitudeEntry` interface and `GRATITUDE_MAX_PER_DAY = 3`, `GRATITUDE_ITEM_MAX_LEN = 280` constants in the Mindset types section. |
| `apps/web/src/app/api/gratitude/route.ts` | Create | `GET` (this month's entries + streak) and `POST` (create one entry for today, enforce max 3/day, Zod-validated). |
| `apps/web/src/app/api/gratitude/[id]/route.ts` | Create | `DELETE` — today-only, owned-by-userId. Mirrors `api/journals/[id]/route.ts`. |
| `apps/web/src/components/mindset/gratitude-form.tsx` | Create | Client component: text input + Add button; disabled/message state when 3 items reached. |
| `apps/web/src/components/mindset/gratitude-list.tsx` | Create | Client component: today's items with delete icon; renders monthly summary grouped by day (past days read-only). |
| `apps/web/src/app/(dashboard)/mindset/gratitude/page.tsx` | Create | Page shell (client component, like `mood/page.tsx`): Header, streak card, form, monthly summary. |
| `apps/web/src/components/layout/sidebar.tsx` | Modify | Add a "Gratitude" nav item (icon `Heart` or `Sparkles`/`Sun` from lucide) after the "Mood" item. |
| `apps/web/src/__tests__/setup.ts` | Modify | Add `gratitudeEntry` mock to the Prisma stub (`findMany`, `findFirst`, `create`, `count`, `delete`). |
| `apps/web/src/__tests__/api/gratitude.test.ts` | Create (tester) | API tests — left to Test Agent, listed for completeness. |
| `apps/web/src/__tests__/components/gratitude-*.test.ts` | Create (tester) | Component smoke tests — left to Test Agent. |

## Implementation steps

1. **DB model** (`schema.prisma`, ~12 lines). Add after the `MoodLog` model:
   ```prisma
   model GratitudeEntry {
     id        String   @id @default(cuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     item      String   // max 280 chars enforced at API layer
     date      DateTime @db.Date
     createdAt DateTime @default(now())

     @@index([userId, date])
     @@map("gratitude_entries")
   }
   ```
   Add `gratitudeEntries GratitudeEntry[]` to the `User` relations block (after `moodLogs` at line 43).

2. **Types** (`packages/types/src/index.ts`, ~12 lines). In the Mindset section (after `MoodLog`, ~line 378):
   ```ts
   export const GRATITUDE_MAX_PER_DAY = 3;
   export const GRATITUDE_ITEM_MAX_LEN = 280;

   export interface GratitudeEntry {
     id: string;
     userId: string;
     item: string;
     date: Date | string;
     createdAt: Date | string;
   }
   ```

3. **API — collection route** (`app/api/gratitude/route.ts`, ~70 lines). Follow `api/mood/route.ts` for structure (requireUser, Zod, ZodError → 400, `getTodayDate()`).
   - **POST**: schema `z.object({ item: z.string().trim().min(1).max(GRATITUDE_ITEM_MAX_LEN) })`. Before create, `count` today's entries scoped to `{ userId, date: today }`; if `>= GRATITUDE_MAX_PER_DAY` return `409` (or `400`) with message `"You've logged your 3 gratitude items for today!"`. Otherwise `prisma.gratitudeEntry.create({ data: { userId, item, date: today } })`, return `201`.
   - **GET**: compute current-month range (`startOfMonth`/`endOfMonth` from `date-fns`). Fetch month entries `where: { userId, date: { gte: monthStart, lte: monthEnd } }`, `orderBy: { date: "desc" }` (then `createdAt` desc). Separately fetch last ~60 days (`where: { userId, date: { gte: subDays(today,60) } }`, ordered) for streak. Compute streak by walking backward from today over distinct dates with ≥1 entry (reset on first gap; if today has none, count from yesterday). Return `{ entries, streak }`.
   - **Streak helper**: inline in the route (or a small `computeStreak(dates: Date[], today: Date)` local function). O(60), uses `[userId, date]` index — satisfies NFR-3.

4. **API — item route** (`app/api/gratitude/[id]/route.ts`, ~16 lines). Copy `api/journals/[id]/route.ts`. `DELETE`: `findFirst({ where: { id, userId } })`; 404 if missing. **Enforce today-only**: compare entry `date` to `getTodayDate()`; if not today return `403` (`"Cannot delete past entries"`) — satisfies FR-6. Else `delete`, return `{ success: true }`.

5. **GratitudeForm component** (`components/mindset/gratitude-form.tsx`, ~45 lines, `"use client"`). Props: `{ todayCount: number; onAdd: (item: string) => Promise<void>; saving: boolean }`. Uses `Input` + `Button`. When `todayCount >= 3`, hide the input and show the message `"You've logged your 3 gratitude items for today!"` (FR-2/AC-2). `maxLength={280}`, trims, clears on success.

6. **GratitudeList component** (`components/mindset/gratitude-list.tsx`, ~55 lines, `"use client"`). Props: `{ entries: GratitudeEntry[]; onDelete: (id: string) => void }`. Groups entries by `yyyy-MM-dd` (date-fns `format`), renders newest day first. For each item: show text; render a trash/delete icon (lucide `Trash2`) **only when the day === today** (FR-5/FR-6/AC-3/AC-6). Empty state ("No gratitude logged yet this month").

7. **Page** (`app/(dashboard)/mindset/gratitude/page.tsx`, ~90 lines, `"use client"`). Modeled on `mood/page.tsx`:
   - State: `entries`, `streak`, `loading`, `saving`.
   - `fetchData()` → `GET /api/gratitude`, set `entries` + `streak`.
   - `addItem(item)` → `POST`, toast success/error, refetch. `deleteItem(id)` → `DELETE /api/gratitude/{id}`, refetch.
   - Derive `todayCount` from entries matching today's `yyyy-MM-dd`.
   - Layout: `<Header title="Gratitude" subtitle="..." />`, a streak card (`glass rounded-xl`, shows `🔥 {streak} day streak`), `<GratitudeForm>`, then a "Monthly Summary" card wrapping `<GratitudeList>`. Loading skeleton matches mood page.

8. **Sidebar** (`components/layout/sidebar.tsx`). Add an icon to the lucide import (e.g. `Heart` is taken by Health; use `Sun` or reuse `Sparkles`) and insert a nav item after the "Mood" entry (line ~77):
   ```ts
   { label: "Gratitude", href: "/mindset/gratitude", icon: Sun, color: "text-amber-400" },
   ```

9. **Test setup stub** (`__tests__/setup.ts`). Add to the Prisma mock:
   ```ts
   gratitudeEntry: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), delete: vi.fn() },
   ```
   (Dev should add this so typecheck/tests are ready; the Test Agent writes the actual test files.)

10. **Typecheck**: `cd apps/web && npx tsc --noEmit` must pass.

## DB changes required?

**Yes.** New `GratitudeEntry` model + `User.gratitudeEntries` relation. After editing the schema:
```bash
cd packages/db && npx prisma db push && npx prisma generate && cd ../..
```
No data migration needed (additive only). Strategy is `db push` (no migrations dir), per KNOWLEDGE.md.

## New packages required?

**None.** `date-fns`, `zod`, `lucide-react`, `sonner`, and shadcn `Input`/`Button`/`Textarea` are all already used by the mood feature.

## Test strategy

- **Unit (lib/streak):** if the streak calc is extracted, test consecutive-day counting, gap reset, today-missing-but-yesterday-present cases (AC-4). If inline, cover via API tests.
- **Integration (API, mocked Prisma):**
  - `GET` scopes to `userId`, filters to current-month range, returns `{ entries, streak }`.
  - `POST` creates with correct `userId`/`date`, returns 201; blocks the 4th item of the day with the friendly message (count >= 3); Zod 400 on empty/over-280-char item.
  - `DELETE` 404 when not owned/missing; 403 when entry is not today's; success when today's.
- **Component smoke tests:** GratitudeForm hides input + shows message at 3 items; GratitudeList shows delete icon only on today's items, none on past days.

## Risk / unknowns

- **Date/timezone handling.** `getTodayDate()` uses server-local midnight and `@db.Date` stores date-only — consistent with MoodLog, but "today" is server-relative (no per-user timezone). Acceptable for v1; matches existing behavior. The streak walk must compare on date-only strings to avoid TZ drift.
- **Max-3 race condition.** Two near-simultaneous POSTs could both pass the `count` check and create a 4th row. Low risk for a single-user daily flow; a stricter guard (transaction or unique constraint) is out of scope for v1 — note for reviewer.
- **Delete-then-readd ordering (AC-3).** After delete, `todayCount` drops and the form re-enables — handled by refetch-on-mutation.
- **HTTP status for the limit case.** Plan suggests 409; Dev may use 400 with the message for simplicity. Either is fine as long as the page surfaces the friendly text.
- **Sidebar icon choice.** `Heart` is used by Health; pick a free lucide icon (`Sun`/`Sparkles`) to avoid visual collision.

## Estimated size

**M** — one new DB model, two API routes (one with streak logic), two components, one page, one nav item, plus test scaffolding. Comparable to SB-29 but slightly larger due to multi-row-per-day logic, streak calculation, monthly grouping, and a delete route.
