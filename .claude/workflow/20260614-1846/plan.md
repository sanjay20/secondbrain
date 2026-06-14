# Implementation Plan: SB-30 — Affirmations

**Jira:** https://sanjay-sahare.atlassian.net/browse/SB-30
**Epic:** SB-27 — Mindset Pillar
**PRD:** `.claude/workflow/20260614-1846/prd.md`

## Overview

Add an **Affirmations** feature to the Mindset pillar. Per the restructured Mindset
design, Affirmations is a **NEW TAB on the existing `/mindset` tabbed page** — NOT a
new sidebar item and NOT a new route. The Mindset page already has "Mood Tracker" and
"Gratitude" tabs; we add a third "Affirmations" tab rendering a new panel component.
A second surface — a **random "Daily Affirmation" card** — is added to the dashboard.

The **Gratitude feature is the direct precedent** and we mirror its file structure and
patterns closely. Two notable simplifications vs. Gratitude: Affirmations have **no
daily cap** and **no streak**, and the model uses **`text` + `createdAt` only** (no
`date` column). Delete is allowed for **any** affirmation (Gratitude only allows deleting
today's entries — we do NOT carry that restriction over).

---

## Affected files

| File | Change type | Notes |
|------|-------------|-------|
| `packages/db/prisma/schema.prisma` | Modify | Add `Affirmation` model; add `affirmations Affirmation[]` relation to `User` |
| `packages/types/src/index.ts` | Modify | Add `Affirmation` interface + `AFFIRMATION_TEXT_MAX_LEN`/`MIN_LEN` consts in the Mindset section |
| `apps/web/src/app/api/affirmations/route.ts` | Create | GET (list, userId-scoped) + POST (create, Zod-validated) |
| `apps/web/src/app/api/affirmations/[id]/route.ts` | Create | DELETE (userId-scoped, ownership check) |
| `apps/web/src/components/mindset/affirmation-form.tsx` | Create | Mirror `gratitude-form.tsx` (no daily-cap branch) |
| `apps/web/src/components/mindset/affirmation-list.tsx` | Create | Mirror `gratitude-list.tsx` (flat list, no date grouping; empty state) |
| `apps/web/src/components/mindset/affirmation-panel.tsx` | Create | Mirror `gratitude-panel.tsx` (fetch/add/delete; no streak) |
| `apps/web/src/app/(dashboard)/mindset/page.tsx` | Modify | Add 3rd `TabsTrigger` + `TabsContent` for Affirmations |
| `apps/web/src/components/dashboard/daily-affirmation.tsx` | Create | Presentational card showing one affirmation (or empty-state link) |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Modify | Fetch affirmations in `getDashboardData()`, pick one at random server-side, render `DailyAffirmation` card in right sidebar |

No sidebar change. No new AI agent. No new route segment beyond `/api/affirmations`.

---

## Implementation steps

1. **DB model** — `packages/db/prisma/schema.prisma`
   Add after the `GratitudeEntry` model (~line 459):
   ```prisma
   model Affirmation {
     id        String   @id @default(cuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     text      String
     createdAt DateTime @default(now())

     @@index([userId])
     @@map("affirmations")
   }
   ```
   Add `affirmations Affirmation[]` to the `User` relations block (~line 44).
   Then run `cd packages/db && npx prisma db push && npx prisma generate`.

2. **Types** — `packages/types/src/index.ts`
   In the "Mindset types" section (after `GratitudeEntry`, ~line 389) add:
   ```ts
   export const AFFIRMATION_TEXT_MIN_LEN = 1;
   export const AFFIRMATION_TEXT_MAX_LEN = 200;

   export interface Affirmation {
     id: string;
     userId: string;
     text: string;
     createdAt: Date | string;
   }
   ```

3. **API list/create route** — `apps/web/src/app/api/affirmations/route.ts`
   Mirror `api/gratitude/route.ts` but simpler (no streak, no date, no daily cap):
   - `GET`: `requireUser()` → `prisma.affirmation.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })` → `NextResponse.json({ affirmations })`.
   - `POST`: `requireUser()`; parse `{ text }` with `z.object({ text: z.string().trim().min(1).max(AFFIRMATION_TEXT_MAX_LEN) })`; on `ZodError` return 400 with `err.errors` (same shape as gratitude); create row; return 201 with the entry.
   - Optional soft cap (Open Q #2): enforce a 50-row ceiling — `count()` and return 409 if exceeded. Recommended to keep parity with gratitude's 409 pattern; mark as low priority.

4. **API delete route** — `apps/web/src/app/api/affirmations/[id]/route.ts`
   Mirror `api/gratitude/[id]/route.ts` but **without** the "today only" restriction:
   - `requireUser()`; `params` is a `Promise<{ id: string }>` (await it — Next 15 pattern);
   - `findFirst({ where: { id, userId: user.id } })` → 404 if not found (ownership scope);
   - `prisma.affirmation.delete({ where: { id } })`; return `{ success: true }`.

5. **Affirmation form** — `apps/web/src/components/mindset/affirmation-form.tsx`
   Mirror `gratitude-form.tsx`: controlled `Input` + `Button`, `maxLength={AFFIRMATION_TEXT_MAX_LEN}`,
   Enter-to-submit, trims input, clears on success. Props: `{ onAdd: (text) => Promise<void>; saving: boolean }`.
   Remove the `todayCount`/daily-cap branch entirely. Placeholder e.g. "I am...".

6. **Affirmation list** — `apps/web/src/components/mindset/affirmation-list.tsx`
   Mirror `gratitude-list.tsx` but **flat** (no date grouping): map `Affirmation[]` to list items
   with a delete (`Trash2`) button on every row (delete allowed for all). Empty state:
   "Add your first affirmation to get started" (satisfies AC-6).

7. **Affirmation panel** — `apps/web/src/components/mindset/affirmation-panel.tsx`
   Mirror `gratitude-panel.tsx`: `useState` for `affirmations`, `loading`, `saving`;
   `fetchData()` GET `/api/affirmations`; `addItem(text)` POST then refetch (toast on success/error,
   handle 409 if soft cap added); `deleteItem(id)` DELETE then refetch; loading skeleton; `glass`
   card wrapping `AffirmationForm` + `AffirmationList`. No streak header.

8. **Mindset page tab** — `apps/web/src/app/(dashboard)/mindset/page.tsx`
   Import `AffirmationPanel`; add `<TabsTrigger value="affirmations">Affirmations</TabsTrigger>`
   after the Gratitude trigger, and `<TabsContent value="affirmations"><AffirmationPanel /></TabsContent>`
   after the Gratitude content. (Satisfies FR-6, AC-1.)

9. **Dashboard widget component** — `apps/web/src/components/dashboard/daily-affirmation.tsx`
   Server-compatible presentational component (no `"use client"`; receives the chosen affirmation as
   a prop). Renders a `glass` card matching "Today's Tasks"/"Today's Habits" styling, with a
   sparkle/heart icon and a "Mindset" deep link (`/mindset`). Props:
   `{ affirmation: { id: string; text: string } | null }`. If `null`, show prompt + link to add one
   (satisfies AC-5, FR-7).

10. **Dashboard data + render** — `apps/web/src/app/(dashboard)/dashboard/page.tsx`
    - In `getDashboardData()`, add to the `Promise.all`:
      `prisma.affirmation.findMany({ where: { userId: user.id }, select: { id: true, text: true } })`.
    - After the array resolves, pick one at random server-side:
      `affirmations.length ? affirmations[Math.floor(Math.random() * affirmations.length)] : null`.
      (Random per page load — Open Q #1 assumption.)
    - Return it from `getDashboardData()` and destructure in `DashboardPage`.
    - Render `<DailyAffirmation affirmation={dailyAffirmation} />` in the right-sidebar `space-y-4`
      column (e.g. above "Today's Habits"). (Satisfies FR-4, FR-5, AC-4.)

11. **Typecheck** — `cd apps/web && npx tsc --noEmit` must pass (NFR-5). Also build types pkg if needed.

---

## DB changes required?

**Yes.** Add `Affirmation` model + `User.affirmations` relation to
`packages/db/prisma/schema.prisma`, then:
```bash
cd packages/db && npx prisma db push && npx prisma generate
```
Uses `prisma db push` (no migration files) per project convention. Non-destructive
(additive table only).

---

## New packages required?

**None.** All dependencies already present: `zod`, `date-fns`, `lucide-react`, `sonner`,
`@radix-ui/react-tabs`, Prisma, Clerk. Reuses existing `requireUser`, `prisma`, and shadcn
`Input`/`Button`/`Tabs` primitives.

---

## Test strategy

- **Unit / Integration — API routes** (mirror `skills`/`gratitude` route tests):
  - `GET /api/affirmations` returns only the caller's affirmations (userId scope — NFR-1).
  - `POST` accepts valid text, rejects empty and >200-char input with 400 (AC-7, NFR-2),
    persists with the authed `userId`.
  - `DELETE /api/affirmations/[id]` removes own affirmation; returns 404 for another user's id
    (ownership scope — NFR-1).
  - Prisma mocked per existing API test setup.
- **Component smoke tests:**
  - `AffirmationList` renders empty state when `entries=[]` (AC-6) and rows + delete buttons otherwise.
  - `AffirmationForm` disables submit on empty input and calls `onAdd` with trimmed text.
  - `DailyAffirmation` renders the affirmation text when provided and the add-prompt when `null` (AC-5).
- **Excluded:** rotation randomness (non-deterministic `Math.random`) is verified by logic
  inspection, not asserted in a flaky test.

---

## Risk / unknowns

- **Open Q #1 (rotation cadence):** Implementing random-per-page-load (simplest, no extra
  state). If the human wants a pinned daily affirmation, that requires a seeded/daily-cached
  selection — out of scope for this plan.
- **Open Q #2 (max affirmations):** Plan includes an optional 50-row soft cap mirroring
  gratitude's 409 pattern. Low risk to omit; flag for plan-gate decision.
- **Prisma client regeneration:** Dev Agent must run `prisma generate` after the schema edit
  or `prisma.affirmation` will not typecheck.
- **Server-rendered randomness:** `Math.random` in a server component is fine here; no hydration
  mismatch because `DailyAffirmation` receives the pre-selected value as a prop (no client-side
  random).
- **Delete-policy divergence:** Unlike Gratitude, we intentionally allow deleting any affirmation
  (FR-3). Reviewer should not flag the missing "today only" guard as a regression.

---

## Estimated size

**M** — one additive DB model, two API routes, three new mindset components, one dashboard
component, and two small edits to existing pages. No new packages, no AI agent, well-precedented
by the Gratitude feature.
