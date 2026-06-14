# Dev Notes — SB-30 Affirmations

## Decisions that differ from or clarify the plan

### Open Q #2: 50-row soft cap
Omitted the optional 50-row soft cap. The plan marked it as "low priority" and noted it
was optional. Keeping the POST handler simple (no count/409 path) reduces surface area for
the tester and reviewer. If a cap is wanted later, a single `prisma.affirmation.count()`
check can be added to the POST handler in one line.

### Open Q #1: rotation cadence
Implemented random-per-page-load as recommended in the plan. `Math.random()` is called
server-side in `getDashboardData()` before the value is passed as a prop to
`DailyAffirmation`, so there is no client/server hydration mismatch.

### dailyAffirmation nullability in dashboard
`allAffirmations[Math.floor(...)]` can technically return `undefined` when the array is
empty, so used `dailyAffirmation ?? null` at the render site to satisfy the
`{ id; text } | null` prop type of `DailyAffirmation`.

### No 50-row cap → no 409 handling in AffirmationPanel
`addItem()` in `affirmation-panel.tsx` has no 409 branch (unlike the Gratitude panel)
since we chose not to implement the cap.

### Sparkles icon chosen for Affirmations
Used `Sparkles` from lucide-react (violet-400) to visually distinguish Affirmations from
Gratitude (which uses `Sun`/amber-400). Consistent in both the panel header and the
dashboard widget.
