## Ticket: SB-4 — Workout log

Add a workout-logging feature to the existing **Health** page. Users record daily exercise sessions (type, duration, notes, date), see them in a reverse-chronological list, delete entries, and view a weekly (Mon–Sun) workout-count summary card. This mirrors the existing Habits pattern: DB model → shared type → `/api/workouts` routes → `health/` components → Health page integration. Workouts appear as a **new "Workouts" section below the habits list on the same Health page** — not a new sidebar item, page, or sub-tab.

Resolved decisions (PRD gate) honoured here:
- `type` is free-text, required, max 50 chars (no dropdown).
- Size **M**.
- Workouts live on the same Health page, section **below** habits.
- `date` is user-editable, defaults to today (past workouts allowed).

---

## Affected files

| File | Change type | Notes |
|------|-------------|-------|
| `packages/db/prisma/schema.prisma` | Modify | Add `Workout` model; add `workouts Workout[]` relation to `User`. |
| `packages/types/src/index.ts` | Modify | Add `Workout` interface + `WORKOUT_TYPE_MAX_LEN`, `WORKOUT_NOTES_MAX_LEN`, `WORKOUT_PAGE_LIMIT` constants. |
| `apps/web/src/app/api/workouts/route.ts` | New | `GET` (list, weekly count, 50-row cap) + `POST` (create, Zod-validated). |
| `apps/web/src/app/api/workouts/[id]/route.ts` | New | `DELETE` (userId-scoped). |
| `apps/web/src/components/health/workout-form.tsx` | New | Dialog + react-hook-form add form (type, duration, date, notes). |
| `apps/web/src/components/health/workout-card.tsx` | New | Single workout row with delete. |
| `apps/web/src/components/health/workout-log.tsx` | New | Section wrapper: weekly summary card + list + empty/loading states + form trigger. |
| `apps/web/src/app/(dashboard)/health/page.tsx` | Modify | Render `<WorkoutLog />` below the habits list. |

No changes to sidebar, middleware, AI agents, or ai-config (AI workout insights explicitly out of scope).

---

## Implementation steps

1. **DB model** — in `packages/db/prisma/schema.prisma`, under the `// ─── HEALTH MODULE ───` section add:
   ```prisma
   model Workout {
     id        String   @id @default(cuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     type      String
     duration  Int
     notes     String?
     date      DateTime @db.Date
     createdAt DateTime @default(now())

     @@index([userId, date])
     @@map("workouts")
   }
   ```
   Add `workouts Workout[]` to the `User` model relation block (next to `habits Habit[]`). `date` uses `@db.Date` to match the Habit/Mood/Gratitude convention (date-only, no time). `@@index([userId, date])` supports the userId-scoped, date-ordered query. (~16 lines)

2. **Shared type + constants** — in `packages/types/src/index.ts`, in the Habit-types region near the top, add:
   ```ts
   export const WORKOUT_TYPE_MAX_LEN = 50;
   export const WORKOUT_NOTES_MAX_LEN = 500;
   export const WORKOUT_PAGE_LIMIT = 50;

   export interface Workout {
     id: string;
     userId: string;
     type: string;
     duration: number;
     notes?: string | null;
     date: Date | string;
     createdAt: Date | string;
   }
   ```
   (~16 lines)

3. **Create+list API** — new `apps/web/src/app/api/workouts/route.ts`:
   - Import `requireUser`, `prisma`, `z`/`ZodError`, `getTodayDate`, and `startOfWeek`/`endOfWeek` from `date-fns` (already a dependency).
   - `createSchema = z.object({ type: z.string().trim().min(1).max(WORKOUT_TYPE_MAX_LEN), duration: z.number().int().positive(), notes: z.string().trim().max(WORKOUT_NOTES_MAX_LEN).optional(), date: z.string().optional() })`. `date` is an ISO `yyyy-MM-dd` string from the date input; if omitted/blank, default to `getTodayDate()`. Parse with `parseISO` + normalise to a date-only `Date` (mirror gratitude/habits) so it stores cleanly in a `@db.Date` column.
   - `GET`: fetch the 50 most recent workouts (`orderBy: { date: "desc" }, then { createdAt: "desc" }`, `take: WORKOUT_PAGE_LIMIT`) scoped to `user.id`. Separately compute the **weekly count** with `prisma.workout.count` where `date` is between `startOfWeek(today, { weekStartsOn: 1 })` and `endOfWeek(today, { weekStartsOn: 1 })` (Mon–Sun). `weekStartsOn: 1` = Monday — required by FR-3/AC-3. Return `{ workouts, weeklyCount }`. Use `Promise.all` for the two queries (mirrors gratitude route).
   - `POST`: `requireUser`, parse body, wrap `createSchema.parse` in try/catch returning `400` with `err.errors` on `ZodError` (gratitude pattern), create the row with `userId: user.id`, return `201`.
   (~60 lines)

4. **Delete API** — new `apps/web/src/app/api/workouts/[id]/route.ts`: mirror `habits/[id]` DELETE exactly. `requireUser`, `params: Promise<{ id: string }>`, `findFirst({ where: { id, userId: user.id } })` → `404` if missing, else `delete` and return `{ success: true }`. No past-date restriction (unlike gratitude — workouts are editable history; deletion of any of the user's own workouts is allowed per AC-6). (~14 lines)

5. **WorkoutForm component** — new `apps/web/src/components/health/workout-form.tsx`, modelled on `habit-form.tsx`:
   - `"use client"`, react-hook-form + `zodResolver`, Dialog with `<Button size="sm"><Plus/>Log Workout</Button>` trigger (label "Log Workout" per AC-1).
   - Fields: `type` (`Input`, placeholder e.g. "Running"), `duration` (`Input type="number"`, registered with `{ valueAsNumber: true }`), `date` (`Input type="date"`, default `new Date().toISOString().slice(0,10)`), `notes` (`Textarea`, optional).
   - Client schema mirrors the server: `type` min 1 / max 50 with messages, `duration` positive int (`z.number().int().positive("Duration must be greater than 0")`), `notes` max 500, `date` required string. Inline `errors.*` messages under each field (AC-4).
   - `onSubmit`: `POST /api/workouts` JSON; on `!res.ok` toast error; on success toast "Workout logged!", `reset()`, close dialog, call `onSuccess()`.
   (~110 lines)

6. **WorkoutCard component** — new `apps/web/src/components/health/workout-card.tsx`, modelled on `habit-card.tsx` (minus the toggle/streak logic):
   - Props: `{ workout: Workout; onUpdate: () => void }`.
   - Glass row: a Lucide `Dumbbell` icon, the `type` (bold), a `Badge` showing `{duration} min`, the formatted `date` (use `formatDate` from `lib/utils`), and `notes` truncated below if present. Trash button (`group-hover` reveal) → `confirm()` → `DELETE /api/workouts/${id}` → toast → `onUpdate()`.
   (~55 lines)

7. **WorkoutLog section component** — new `apps/web/src/components/health/workout-log.tsx`:
   - `"use client"`. On mount, `fetch("/api/workouts")` → `{ workouts, weeklyCount }`; hold both in state plus a `loading` flag. Expose a `refresh` callback passed to `WorkoutForm.onSuccess` and `WorkoutCard.onUpdate`.
   - Render order: a section header `"Workouts"` with the `WorkoutForm` trigger on the right; a **weekly summary card** (reuse `StatsCard` from `components/dashboard/stats-card`, title "This week", `value={weeklyCount}`, icon `Dumbbell` or `Activity`) — satisfies FR-3/AC-3; then loading skeletons / empty state (Dumbbell icon + "No workouts yet" + form) / the mapped `WorkoutCard` list.
   - Keep this as a self-contained section component so the Health page change is a one-line insert and habits state is untouched.
   (~95 lines)

8. **Health page integration** — in `apps/web/src/app/(dashboard)/health/page.tsx`, import `WorkoutLog` and render `<WorkoutLog />` inside the `flex-1 p-6 space-y-6` container, **below** the habits list block (after the `loading ? … : habits.length === 0 ? … : (…)` block, still inside that div). No change to the existing habits stats grid or AI insight block. (~2 lines)

9. **Schema sync + typecheck** (Dev agent runtime, not code): `cd packages/db && npx prisma db push && npx prisma generate`, then `cd apps/web && npx tsc --noEmit` must pass.

---

## DB changes required?

**Yes.** New `Workout` model + `User.workouts` relation. After editing the schema:
```bash
cd packages/db && npx prisma db push && npx prisma generate
```
Strategy is `db push` (no migrations dir), per KNOWLEDGE.md. `@db.Date` column, single composite index `@@index([userId, date])`. Purely additive — no changes to existing tables, so no data risk.

---

## New packages required?

**None.** All dependencies already present: `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns` (provides `startOfWeek`/`endOfWeek`/`parseISO`), `sonner`, `lucide-react`, and all shadcn `ui` primitives (`Input`, `Textarea`, `Button`, `Label`, `Dialog`, `Badge`). `StatsCard` already exists.

---

## Test strategy

- **Integration (API routes) — `apps/web/src/app/api/workouts/route.ts` + `[id]/route.ts`:**
  - `POST` with valid body → `201`, row scoped to `userId`.
  - `POST` rejects: blank `type`, `type` > 50 chars, `duration` ≤ 0 / non-integer, `notes` > 500 → `400` (FR-6).
  - `POST` with omitted `date` defaults to today; with explicit past `date` stores that date.
  - `GET` returns at most 50 rows (`WORKOUT_PAGE_LIMIT`), newest first (AC-7).
  - `GET` `weeklyCount` counts only Mon–Sun of the current week (seed rows just inside/outside the week boundary to verify `weekStartsOn: 1`) — AC-3.
  - `DELETE` of another user's workout → `404` (userId scoping); own workout → `{ success: true }`.
  - Mock Prisma in the same style as existing API tests (see the skills route tests added in SB-13).
- **Unit:** the date-normalisation / default-to-today helper if extracted; otherwise covered via POST tests.
- **Component smoke tests:** `WorkoutForm` renders fields and shows a validation error when submitting `duration = 0` or empty `type` (AC-4); `WorkoutCard` renders type/duration/date and fires DELETE on trash click.
- 401 behaviour (AC-5) is enforced by Clerk middleware (`auth.protect()` on all non-public `/api/*`), not the handler — note in test-report; an integration test can assert `requireUser` rejection propagates if desired.

---

## Risk / unknowns

- **Week boundary semantics:** FR-3/AC-3 specify Mon–Sun. Must pass `{ weekStartsOn: 1 }` to `date-fns` `startOfWeek`/`endOfWeek` (default is Sunday). This is the single most likely correctness bug — called out explicitly.
- **Timezone / `@db.Date`:** Habits, mood, and gratitude all use `@db.Date` with `getTodayDate()` (local midnight). Reuse the same normalisation so the user-supplied `date` string maps to the intended calendar day without UTC drift. The weekly-count query must compare against the same date-only basis.
- **`duration` typing in the form:** number inputs yield strings; must register with `valueAsNumber: true` (or coerce) so the `z.number()` client schema and the JSON sent to the server are actually numeric, otherwise validation/serialization silently breaks.
- **`@db.Date` + range query inclusivity:** ensure `endOfWeek` upper bound includes Sunday — since the column is date-only, a `lte: endOfWeek(...)` (which carries a time component) is safe, but verify in tests.
- **No update/edit** (out of scope) — confirm WorkoutCard exposes delete only, no edit affordance.

---

## Estimated size

**M** (matches PRD: ~2–3 days). One additive DB model, two API route files, three new components, and a one-line page integration — all closely mirroring the established Habits/Gratitude patterns.
