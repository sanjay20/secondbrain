## Review: SB-37 — 5-Year Life Goals (epic SB-36 — Vision Board Pillar)
Branch: feature/SB-37-five-year-goals

Reviewed the full diff against `master`. Note: because SB-36 is not yet on `master`, the
diff includes the SB-36 vision scaffolding (`VisionArea` model, `/api/vision`,
`vision-card`/`vision-form`, `sidebar` Vision link, `vision-agent` base). Those were
reviewed in passing for regressions; the focus below is the SB-37 surface (five-year-goals
+ monthly-goals API/UI, the `vision-agent` 5-year extension, and `vision-insight` route).

Typecheck: `npx tsc --noEmit` → clean (exit 0).
Tests: `npx vitest run` → 22 files, 325 tests, all passing.

---

### MUST FIX
_None._

All DB queries are `userId`-scoped; every PATCH/DELETE on `five-year-goals/[id]` and
`monthly-goals/[id]` performs an ownership check via `findFirst({ id, userId })` → 404
before mutating. `monthly-goals` POST verifies parent `fiveYearGoal` ownership (404 on
cross-user link). All external inputs are Zod-validated (400 on failure). `requireUser()`
gates every route; `/vision` is behind Clerk middleware (not in the public allowlist).
No secrets committed. The one-active-per-pillar 409 rule is enforced on both POST and the
archived→active PATCH transition. Architecture follows the canonical
DB → type → agent → API → page → sidebar pattern with no superfluous abstractions.

---

### SHOULD FIX
- [x] [Perf] **RESOLVED.** `five-year-goals/route.ts` GET now accepts an optional
  `?month=YYYY-MM`, adds `take: 100` on the outer query and `orderBy` + `take: 200` on the
  `monthlyGoals` include (filtered by `month` when present). `MonthlyReviewTab` now fetches
  `?month=${currentMonth}`, so it no longer pulls every monthly goal for all time.
  `monthly-goals/route.ts` GET gained `take: 200`. New tests cover the take limits and the
  month filter.
- [x] [UX] **RESOLVED BY ANALYSIS — no change.** `components/ui/tabs.tsx` uses radix
  `TabsPrimitive.Content` without `forceMount`, so inactive tabs unmount and refetch on every
  switch — there is no staleness window in practice (each switch yields a fresh fetch).
  A shared SWR cache would be over-engineering and conflicts with the now-divergent per-tab
  query shapes from the Perf fix above.
- [x] [UX] **NO CHANGE — already consistent.** The Status `Select` uses the same
  `defaultValue` + `setValue` pattern as the sibling `five-year-goal-form.tsx` pillar Select,
  and `status` is present in `defaultValues` (`"todo"` on create, `goal.status` on edit), so
  it is included in the submitted payload. Switching to `Controller` would make it
  *inconsistent* with the sibling form.

### SUGGESTIONS
- [ ] [UX] `monthly-goals-list.tsx:71` uses a raw "✏" emoji as the edit-button glyph while
  every other control uses a `lucide-react` icon. Swap for `<Pencil className="w-3 h-3" />`
  for visual consistency.
- [ ] [Test] UI components (`five-year-goal-card`/`-form`, `monthly-*`, `vision/page.tsx`)
  have no render/interaction tests — flagged by the Test agent as deferred. The AC-6
  computed "done/total (pct%)" line and the AC-5 review checkbox toggle are the highest-value
  smoke tests to add later.
- [ ] [Arch] `vision-agent.ts` `visionInsight` token budget left at 600 (dev-notes #7). Fine
  for now; bump to 800 if live responses truncate once the 5-year goal block is included.
- [ ] [UX] `monthly-review-tab.tsx` computes "current month" from the browser clock
  (`getCurrentMonth`). A user near a timezone boundary at month-end could see a different
  month than the server would compute. Acceptable for a single-user personal app.

---

### Approved by
- [x] Architect ✅ — follows KNOWLEDGE.md module pattern; consistent with vision/wealth modules; no unnecessary abstractions; package deps correct.
- [x] Security ✅ — every query userId-scoped; ownership checks on all mutations; parent-FK ownership on monthly POST; Zod on all inputs; Clerk gate intact; no secrets.
- [x] Perf/UX ✅ (with SHOULD FIX) — loading/empty states handled everywhere; AI endpoint returns graceful errors; `"use client"` only on interactive components. Missing `take` limits noted as SHOULD FIX (consistent with existing code, not a regression).
