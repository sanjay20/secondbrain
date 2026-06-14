# Review: SB-29 — Mood tracker (Mindset Pillar)
Branch: feature/SB-29-mood-tracker

Reviewed the full diff against `master` (13 files, +706/-1) through three reviewer
perspectives. The implementation closely follows the canonical feature-module pattern
(DB → type → API → page → sidebar) and the existing `journals` / habit-log conventions.
Quality is high; there are **no MUST FIX items**.

---

## MUST FIX
_(none)_

All security-critical checks pass:
- `userId` scoping present on **every** query — `findMany({ where: { userId: user.id } })`
  and `upsert({ where: { userId_date: { userId: user.id, date } }, create: { userId: user.id, … } })`.
- Zod validation on the POST body (`mood` int 1–5, `note` max 500), with explicit
  `ZodError → 400` (AC-6). This is actually stricter than the existing `journals`/`goals`
  routes, which let `parse` throw.
- No secrets committed; no `.env*` changes.
- Clerk auth not bypassed — `requireUser()` is called first in both handlers; the
  `/mindset/*` path is covered by the existing middleware gate (only `/sign-in`,
  `/sign-up`, `/api/webhooks` are public).
- No raw SQL; Prisma parameterises everything.

---

## SHOULD FIX
- [ ] [UX] `apps/web/src/app/(dashboard)/mindset/mood/page.tsx:39` — on a failed initial
  `fetch`, the page toasts an error but then renders the normal mood form + chart empty
  state, indistinguishable from a user who simply has no data. Consider a dedicated error
  state (or a retry affordance) so a transient load failure isn't silently presented as
  "no mood data yet".
- [ ] [Arch] No `/mindset` landing page exists; the sidebar links directly to
  `/mindset/mood`. Navigating to `/mindset` directly 404s. This was flagged and accepted
  at the plan gate (separate story under SB-27), but worth a human confirm before merge.

## SUGGESTIONS
- [ ] [Perf] `mood-chart.tsx:27` — for each of the 7 day slots the series builder runs
  `data.find(...)` with a per-element `format(new Date(e.date), …)` (O(7·N), N≤30). Trivial
  at this scale, but pre-bucketing `data` into a `Map<dateKey, mood>` once would be cleaner
  if the window ever grows. Not worth changing now.
- [ ] [Build] `apps/web/tsconfig.tsbuildinfo` is committed in the diff. This is a TS
  incremental-build artifact and is **already tracked in the repo** (pre-existing), so this
  branch only bumps it. Recommend (separately) gitignoring it and `git rm --cached`-ing it
  repo-wide; out of scope for this ticket.
- [ ] [UX] `mood-selector.tsx` buttons expose mood only via numeric label + `title`
  tooltip. Consider an `aria-label={label}` / `aria-pressed={selected}` for screen-reader
  and keyboard accessibility. Minor.
- [ ] [Type] `MOOD_LEVELS` is typed `Record<number, …>`, so `MOOD_LEVELS[level]` is
  non-`undefined` by the type system even for out-of-range keys. Fine given the literal
  `[1,2,3,4,5]` iteration, but a `Record<1|2|3|4|5, …>` would be marginally safer.

---

## Approved by
- [x] Architect ✅ — follows the DB→type→API→page→sidebar pattern; mirrors `journals` +
  habit-log upsert; no unnecessary abstractions; correct package boundaries
  (`@secondbrain/types` for `MoodLog`/`MOOD_LEVELS`, `@secondbrain/db` schema, recharts
  already a dependency).
- [x] Security ✅ — userId scoping on all queries, Zod-validated input, explicit 400 on
  bad input, no secrets, Clerk gate intact.
- [x] Perf/UX ✅ — `take: 30` limit, no N+1 (single `findMany`, single `upsert`),
  `"use client"` only on interactive components/page, loading skeleton + chart empty state
  present, API returns sensible 400 errors.

**Verification after review:** `npx tsc --noEmit` passes (exit 0); `npx vitest run` →
33 files, 487 tests, all passing. No MUST FIX changes were required, so nothing was
modified.
