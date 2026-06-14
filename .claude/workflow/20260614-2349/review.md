## Review: SB-4 — Workout log
Branch: feature/SB-4-workout-log

Reviewed the full diff against `master` from three perspectives (Architect, Security,
Performance/UX). Baseline before review: `tsc --noEmit` exit 0; 92 workout tests pass.

---

### MUST FIX

_None._

All security-critical invariants hold:
- **GET** `findMany` and `count` are both scoped to `userId: user.id`
  (`api/workouts/route.ts:34,40`).
- **POST** `create` writes `userId: user.id` and validates every input with Zod
  (`api/workouts/route.ts:13-18,66-74`) — `type` trimmed min 1 / max 50, `duration`
  positive int, `notes` trimmed max 500, `date` optional string.
- **DELETE** ownership guard is correct: `findFirst({ where: { id, userId: user.id } })`
  → `404` if not owned, only then `delete` (`api/workouts/[id]/route.ts:9-13`).
- Clerk auth is enforced by middleware (`auth.protect()` on all non-public `/api/*`)
  and every handler calls `requireUser()` first — auth gate not bypassed.
- `weekStartsOn: 1` (Mon–Sun) is correctly applied to both `startOfWeek`/`endOfWeek`
  (`api/workouts/route.ts:42-43`) — the single highest-risk correctness item from the
  plan is implemented correctly.
- `take: WORKOUT_PAGE_LIMIT` (50) bounds the list; weekly figure uses `count()`, not a
  full fetch; both queries run under one `Promise.all`. No N+1.
- `"use client"` appears only on the three interactive components; route handlers are
  server-side. Loading skeletons + empty state present in `workout-log.tsx`.
- No secrets committed.

---

### SHOULD FIX

- [ ] [Security/Perf] `api/workouts/route.ts:42-43` — **Weekly-count boundary uses
  local-time Date against a `@db.Date` column.** `startOfWeek`/`endOfWeek` return
  local-time `Date`s (local Mon 00:00 and local Sun 23:59:59.999). Prisma serialises
  these to UTC before comparing against the date-only column, so for users in
  timezones east of UTC the Monday lower bound can shift to the previous Sunday in
  UTC and pull an out-of-week row into the count (and symmetrically at the upper
  bound). This **mirrors the existing gratitude route** (`startOfMonth`/`endOfMonth`
  used the same way), so it is a consistent pre-existing pattern rather than a
  regression — hence SHOULD, not MUST. If exact Mon–Sun counts matter near midnight
  for non-UTC users, normalise the bounds to date-only the same way `resolveDate`
  does (e.g. compare against `new Date(y, m, d)` for the week start/end day), or run
  the comparison in the user's stored `timezone`. Recommend tracking as a follow-up
  that fixes gratitude + workouts together for consistency.

- [ ] [Arch] `api/workouts/route.ts:53-64` (POST) does not catch malformed JSON.
  `await req.json()` throws a `SyntaxError` (not a `ZodError`) on a non-JSON body,
  which becomes an unhandled 500 rather than a 400. The gratitude/habits routes have
  the same gap, so this is consistent with the codebase — flagged only because the
  plan called for "sensible API errors (400/404)". Optional hardening: wrap
  `req.json()` and return 400 on parse failure.

---

### SUGGESTIONS

- [ ] [UX] `workout-form.tsx:42-58` — `onSubmit` does not wrap `fetch` in try/catch, so
  a network-level failure (offline / DNS) rejects the promise instead of showing the
  "Failed to log workout" toast. The `!res.ok` branch only covers HTTP error
  responses. Habit form has the same shape; minor.

- [ ] [UX] `workout-form.tsx:20` + `route.ts:16` — `notes` is `.trim().max(500)` with no
  `min`, so an all-whitespace note is stored as `""`. `WorkoutCard` renders notes
  behind `if (workout.notes)`, and `""` is falsy, so this is harmless in the UI. No
  action needed; noting for completeness.

- [ ] [Hygiene] `apps/web/tsconfig.tsbuildinfo` is a tracked build artifact (not
  gitignored) and gets rewritten on every `tsc` run, producing churn in unrelated
  diffs. Pre-existing — the file is on `master`, not introduced by this PR. Consider a
  separate cleanup PR to add `*.tsbuildinfo` to `.gitignore` and `git rm --cached` it.
  Out of scope here.

---

### Approved by
- [x] Architect ✅ — follows DB→type→API→component→page pattern; mirrors Habits/Gratitude;
  `resolveDate` extraction is justified (single non-obvious WHY); no unnecessary
  abstractions; package deps correct (types/db/web).
- [x] Security ✅ — userId scoping on every query (findMany, count, create, findFirst,
  delete); Zod on all inputs; DELETE ownership guard correct; Clerk not bypassed; no
  secrets.
- [x] Perf/UX ✅ — take:50 cap; count() for weekly; Promise.all (no N+1); Mon–Sun window;
  date-only normalisation; "use client" only where needed; 400/404 errors;
  loading/empty states present. (One SHOULD-FIX timezone-boundary note, matching
  existing pattern.)
