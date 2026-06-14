## Review: SB-28 — Gratitude Log
Branch: feature/SB-28-gratitude-log

Reviewed the full diff against `master` from three perspectives (Architect, Security, Performance/UX).
Baseline before fixes: `tsc --noEmit` passes, full suite 561/561 passing.

---

### MUST FIX
- [x] [Perf/Correctness] `apps/web/src/app/api/gratitude/route.ts:13-28` — `computeStreak` has a timezone bug.
      It parses the date-key strings with `new Date(todayKey)` / `new Date(startKey)` (which `date-fns`/JS
      interpret as **UTC midnight** for `"yyyy-MM-dd"` strings) and then re-formats with `format(...,"yyyy-MM-dd")`
      (which uses **server-local time**). In any timezone west of UTC the formatted cursor key shifts back a day
      (verified: `TZ=America/Los_Angeles` turns `"2026-06-14"` into `"2026-06-13"`), so the cursor keys never
      match the locally-formatted `distinctDates` set and the **streak is computed as 0 / wrong**. The streak is a
      primary feature requirement (FR/AC-4). It happens to work on the current IST (+5:30) host, but is a latent
      correctness bug under any negative-offset server timezone. Fixed by parsing the keys as local-time dates
      (`parseISO` returns local midnight for date-only strings, keeping parse and format in the same frame).

---

### SHOULD FIX
- [ ] [Perf/Concurrency] `apps/web/src/app/api/gratitude/route.ts:71-84` — max-3-per-day is enforced with a
      read-then-write (`count` then `create`) with no DB-level guard. Two near-simultaneous POSTs can both pass the
      count check and create a 4th row. Plan flagged this as out-of-scope for v1 and the risk is low for a
      single-user daily flow, but a durable guard would be a `@@unique([userId, date, <slot>])` or wrapping the
      check+create in a `prisma.$transaction`. Left for human decision.
- [ ] [UX] `apps/web/src/app/(dashboard)/mindset/gratitude/page.tsx:43-64` — `addItem` calls `await fetchData()`
      (a full GET refetch incl. streak recompute) after every add/delete. Fine functionally, but for a 3-items/day
      flow an optimistic local update would feel snappier and halve the API round-trips. Cosmetic; left for human.

---

### SUGGESTIONS
- [ ] [Arch] `apps/web/src/app/api/gratitude/route.ts:30-54` — the month `findMany` has no `take` limit (mood's GET
      uses `take: 30`). It is bounded by the month-range `where` + `[userId, date]` index, so worst case is ~90 rows;
      acceptable. Add a defensive `take` only if you want strict parity with the mood route.
- [ ] [UX] `apps/web/src/components/mindset/gratitude-list.tsx:21` and `page.tsx:23` — "today" is computed with
      `new Date()` on the client, while the API derives "today" from the server clock (`getTodayDate()`). For a user
      whose local day differs from the server day, the client may show a delete icon on a row the server will reject
      (403). Minor; the 403 is handled gracefully. Could pass the server's today key down from the API for exactness.
- [ ] [Arch] Streak helper is inlined module-scoped in the route (per dev-notes, plan-allowed). If a second feature
      ever needs day-streak logic, extract to `lib/`. No action needed now.

---

### Approved by
- [x] Architect ✅ — follows DB→type→API→page→sidebar pattern; mirrors SB-29 mood + journals delete route; no
      unnecessary abstractions; package deps correct.
- [x] Security ✅ — every query scoped to `userId` (GET both findMany, POST count + create, DELETE findFirst by
      `{id, userId}`); Zod validation on POST input; ZodError → 400; DELETE 404 ownership + 403 past-day guards both
      correct; Clerk `requireUser()` on every handler; no secrets committed.
- [x] Perf/UX ✅ (after fix) — 1 MUST FIX (streak timezone) resolved; no N+1 (two bounded queries via `Promise.all`,
      streak uses `select: { date: true }` over the `[userId, date]` index); `"use client"` only on interactive
      components; sensible status codes (201/400/403/404/409); loading skeleton + empty states present.
