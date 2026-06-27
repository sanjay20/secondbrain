## Review: SB-45 — Streak Motivation Nudges
Branch: feature/SB-45-streak-nudges

Reviewed the full diff vs `master` (13 files, +1458/-5) across three reviewer perspectives.
The intentional divergences from goal-conflict (flat `NudgeOutput` response, no DB cache table,
HTTP 200 `{hasNudge:false}` on any AI error/timeout, the `monthly-score.test.ts` `PillarScore[]`
annotation) are per the PRD/plan and are **not** flagged. Typecheck is clean and the full
Vitest suite (58 files, 1073 tests) is green.

### MUST FIX
_None._ The implementation faithfully mirrors the goal-conflict / briefing agent pattern,
is correctly userId-scoped everywhere, gates auth with `requireUser()` → 401, and handles the
silent-failure / loading / empty / dismiss states correctly.

### SHOULD FIX
- [ ] [Perf/Correctness] `apps/web/src/app/api/habits/[id]/log/route.ts` writes `HabitLog.date`
  via `getTodayDate()` (server-local midnight as a `@db.Date`), while detection in
  `apps/web/src/lib/habit-streak.ts` scans a `userDayRange` half-open **UTC** window. When the
  server's local timezone differs from the user's `timezone`, a log written "today" could fall
  just outside the detection window (or vice-versa), so a habit completed today might still be
  read as broken (or a real break missed). This is a **pre-existing** tz-modeling inconsistency
  across the whole habit subsystem (the dashboard queries logs the same way), and the plan's Risk
  section explicitly accepted it for MVP — the 2-calendar-day half-open window is robust in the
  common case (server tz == APP_TZ == user tz). Left for the human: either standardise habit-log
  writes on `userDayRange`/`dateStringToUtc`, or accept as documented. Not introduced by this PR.

- [ ] [UX] Noisy-nudge edge case (plan Risk): a habit created today legitimately has no
  yesterday log and reads as a 2-day break, so a brand-new habit can trigger a nudge. The plan
  proposed an optional `habit.streak > 0` or `createdAt` older than 2 days filter and deferred it.
  If early-adoption noise is a concern, add `streak: { gt: 0 }` (or a `createdAt` floor) to the
  `habit.findMany` where-clause in `habit-streak.ts`. Cheap, no schema change. Deferred per plan.

### SUGGESTIONS
- [ ] [Security/Defense-in-depth] `nudge-agent.ts` interpolates user-controlled `userName` and
  habit `name`/`category`/`icon` into the LLM prompt unsanitised. This is **consistent with the
  existing pattern** (goal-conflict embeds goal titles the same way) and the output is parsed as
  strict JSON with a mock fallback, so the blast radius is low. No action required for parity; a
  future cross-cutting improvement could centralise light prompt-input escaping for all agents.
- [ ] [Perf] `habit.findMany` in `habit-streak.ts` selects all Habit columns; only
  `id, name, category, icon, streak` are used. A `select` would trim the row payload slightly.
  Micro-optimisation; goal-conflict already uses `select`, so this would also improve consistency.
- [ ] [UX] The card renders nothing while the POST is in flight (no skeleton). That matches the
  "non-critical, silent" philosophy and avoids layout flash for the common no-nudge case, so it
  is the right call — noted only for completeness.
- [ ] [UX] `nudge.habits` chips use the array index as React `key`. Habit names are effectively
  unique here so it's fine; a name-based key would be marginally more correct.

### Approved by
- [ ] Architect ✅ — mirrors goal-conflict/briefing exactly: inline agent types (no
  `@secondbrain/types` import), ai-config union + FEATURES entry, index re-export, thin route +
  pure testable detection helper, card matches `goal-conflict-card` styling. No premature
  abstraction. `streakNudge: MODELS.fast` is correct intent; the Opus global trial override
  routes it to powerful at runtime (maxTokens still applies) — consistent, not a defect.
- [ ] Security ✅ — every Prisma query scoped by `userId` (`habit.findMany` and
  `habitLog.findMany`, the latter covered by `@@index([userId, date])`); `requireUser()` gate
  returns 401 on failure; no secrets; localStorage key is an ISO date only (safe). Unsanitised
  prompt interpolation noted as a parity-consistent suggestion, not a blocker.
- [ ] Perf/UX ✅ — 2-day detection is a **single** `habitLog.findMany` (no N+1); `"use client"`
  only on the card; silent-failure path returns 200 `{hasNudge:false}` and never crashes the
  dashboard; empty/dismiss states handled; all `localStorage` access guarded with
  `typeof window !== "undefined"` for SSR safety; fetch is cancellation-guarded on unmount.

**Verdict: APPROVED — 0 MUST FIX. Safe to proceed to PR.**
