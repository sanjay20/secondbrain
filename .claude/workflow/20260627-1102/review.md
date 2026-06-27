## Review: SB-44 — Monthly Life Score
Branch: feature/SB-44-monthly-life-score

Reviewed the full diff against master (13 files, +1991/-5): Prisma model, AI agent,
ai-config/index re-exports, `monthRange` helper, dual-method API route, recharts
radar card, dashboard wiring, and 3 test files. Verified all schema field names,
the `Pillar`/`LIFE_PILLARS` parity, `requireUser` semantics, and the
Weekly-Review / Goal-Conflict templates.

### MUST FIX
_(none)_

### SHOULD FIX
- [ ] [Perf] `apps/web/src/app/(dashboard)/dashboard/page.tsx:80-110` — the prior-month
      lookup for trend seeding is a second `await` issued sequentially **after** the
      main `Promise.all`. It is a single indexed `findUnique`, so the cost is small,
      but it adds one serial round-trip to every dashboard load even when the user has
      no monthly score. Consider gating it (already gated on `latestMonthlyScore`) or
      folding the trend computation into a small raw aggregate. Low priority.
- [ ] [Arch] Trend-seeding logic is duplicated: `computeTrend`/`priorMonth` live in
      `route.ts` and an inline re-implementation lives in `page.tsx`
      (`buildInitialScore`). They are intentionally kept separate (route owns the API
      shape, page owns SSR seeding) but the divergence risk is real — if the trend
      rule changes, both must change. Consider extracting a shared
      `lib/monthly-score.ts` helper used by both. Not blocking.

### SUGGESTIONS
- [ ] [Correctness] `buildContext` filters `@db.Date` columns (`HabitLog.date`,
      `MoodLog.date`, `Workout.date`, `GratitudeEntry.date`) with the tz-adjusted
      `monthRange`, whose `gte`/`lt` can fall on the prior/next day's UTC instant for
      non-UTC offsets. Date-only rows on the first/last day of a month could be
      mis-bucketed by one day at month boundaries. This exactly mirrors the existing
      `weekRange` usage across the app, so it is consistent — flagging only for
      awareness. If precise month boundaries matter, compare date-only columns against
      calendar dates rather than tz-shifted datetimes.
- [ ] [UX] `JournalEntry`/`GratitudeEntry`/`MoodLog` counts use `createdAt` (or `date`)
      for the month window; an entry back-dated by the user (logged late for a past
      day) is bucketed by its `createdAt`, not the day it refers to. Acceptable for an
      aggregate score, noted for completeness.
- [ ] [UX] The radar `<Radar>` fill colour is hard-coded `#818cf8` (indigo) rather than
      derived from `PILLAR_META` colours. Fine for a single-series radar; mentioned in
      case per-pillar colour is desired later.
- [ ] [Perf] `personal.gratitudeEntriesThisMonth` and
      `relationships.gratitudeEntriesThisMonth` reuse the same single `gratitudeCount`
      query (documented in dev-notes) — correct and efficient, no change needed.

### Approved by
- [ ] Architect ✅
- [ ] Security  ✅
- [ ] Perf/UX   ✅
