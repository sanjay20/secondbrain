# Dev Notes — SB-22 Daily Work Pillar

## Decisions that differ from the plan

### 1. `date-fns-tz` not available — used native `Intl` API instead
**Plan said:** use `date-fns` (already a dep) for timezone-aware day math.  
**What happened:** `date-fns-tz` is not installed in the workspace and adding it via pnpm from a subpackage context threw a workspace-root error. `date-fns` v4 does not include TZ utilities built-in.  
**Decision:** implemented `apps/web/src/lib/datetime.ts` using the native `Intl.DateTimeFormat.formatToParts` API (zero extra deps). Covers `startOfDayInTz`, `endOfDayInTz`, `userDayRange`, `weekRange`, `sameDayInTz`.

### 2. `DayPlanItem` / `PlannerResult` inlined in ai-core agent, not imported from `@secondbrain/types`
**Plan said:** add `DayPlanItem`/`PlannerResult` to `packages/types/src/index.ts`.  
**What happened:** `packages/ai-core` does not list `@secondbrain/types` as a dependency, so `import from '@secondbrain/types'` fails tsc inside that package.  
**Decision:** types are defined in both places — in `packages/types` (for the web app and UI) and exported directly from the agent file. The web-facing types in `@secondbrain/types` and the agent's local types are structurally identical.

### 3. Rollover processes ALL users (no per-user timezone fan-out scheduler)
As noted in the plan's risk section: v1 exposes the secured POST `/api/dailywork/rollover` endpoint; it iterates all users and uses `startOfDayInTz(now, user.timezone)` to determine each user's local midnight correctly. However, calling this endpoint at a single UTC midnight will not be exactly "local midnight" for every timezone. Full per-user-tz scheduling requires an external scheduler (e.g., trigger at each hour and filter by which users' local midnight that hour represents). Flagged for follow-up.

### 4. `process.env` in `lib/datetime.ts` — IDE false positive
The tsconfig uses `dom` lib only. The IDE shows a "Cannot find name 'process'" error in `datetime.ts`, but `pnpm --filter @secondbrain/web type-check` (which uses the full Next.js plugin context) passes clean. This is consistent with how other `lib/*.ts` files use `process.env` without declaring `node` types.

### 5. Dashboard page — `isMonday` function imported from `date-fns`
`date-fns` v4 exports `isMonday` as a named function. Used directly to show the weekly review prompt on the dashboard on Mondays.

### 6. `mobile-nav.tsx` not modified
The plan mentioned updating `mobile-nav.tsx`. On inspection, `mobile-nav.tsx` only contains the context provider — there is no nav item list there. The Sidebar component already handles both mobile (slide-in) and desktop nav via the same `navItems` array and `useMobileNav` context. Adding `Daily Work` to `sidebar.tsx` covers both layouts.

## Files created (beyond the plan's listing)
- No additional files created beyond the plan.

## Pre-existing typecheck errors (baseline before this branch)
- Multiple `Parameter 'x' implicitly has an 'any' type` errors in existing routes (dashboard, habits, wealth, AI insight routes). These predate this branch and are not introduced by our changes.
