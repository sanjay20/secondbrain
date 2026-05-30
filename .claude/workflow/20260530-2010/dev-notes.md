# Dev Notes — SB-37 Five-Year Goals

## Branch
`feature/SB-37-five-year-goals` branched from `feature/SB-36-vision-board` as required.

## Decisions that differ from or elaborate on the plan

### 1. One-active-per-pillar enforcement (API, not DB unique constraint)
Implemented via `findFirst({ userId, pillar, status: "active" })` → 409 on POST, as specified.
A `@@unique([userId, pillar])` would block re-creation after archiving because a new "active" row
would conflict with archived rows. The API approach is intentionally weaker against concurrent
double-POST (race window), but this is acceptable for a single-user personal app and noted as a
known limitation.

### 2. Monthly Review data source — option (a): reuse five-year-goals GET include
`MonthlyReviewTab` calls `/api/vision/five-year-goals` (which includes `monthlyGoals`), then
filters client-side by `month === currentMonth`. This reduces round-trips vs. calling
`/api/vision/monthly-goals?month=`. The trade-off is that all monthly goals for all time are
fetched; acceptable for this app's expected data volume.

### 3. VisionContext.fiveYearGoals is required (not optional)
The plan called for extending `VisionContext` with a new `fiveYearGoals` field. We made it
required (not `?`) because callers always have the data available and it simplifies the type.
The existing SB-36 test file (`vision-agent.test.ts`) was updated to pass `fiveYearGoals: []`
to satisfy the new interface — this was a necessary fix to make typecheck pass.

### 4. targetYear default in POST handler
`targetYear` defaults to `new Date().getFullYear() + 5` computed at request time, per plan.
No DB-level default — the API always sets it explicitly.

### 5. Pillar not editable in five-year-goal PATCH
Per plan: pillar is the goal's identity. The PATCH schema excludes `pillar`. The form
disables the pillar Select in edit mode.

### 6. Archive via PATCH status="archived", not a dedicated endpoint
Consistent with plan and codebase pattern. The re-activation path (archived→active) in
PATCH also runs the one-active-per-pillar check.

### 7. AI token budget
Did not bump `visionInsight` maxTokens from 600 to 800. The added prompt text is modest and
600 tokens is sufficient for the expected response length. Can be bumped if live responses
truncate.
