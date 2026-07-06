# Test Report — SB-45 Streak Motivation Nudges

Branch: `feature/SB-45-streak-nudges`
Test agent run: 2026-06-27

---

## Files Created

| File | Type | Tests |
|------|------|-------|
| `apps/web/src/__tests__/api/nudge-agent.test.ts` | AI agent unit test | 25 |
| `apps/web/src/__tests__/lib/habit-streak.test.ts` | Library unit test | 24 |
| `apps/web/src/__tests__/api/streak-nudge-route.test.ts` | Route integration test | 24 |
| `apps/web/src/__tests__/components/streak-nudge-card.test.ts` | Component smoke test | 22 |

**Total: 95 new tests across 4 files.**

---

## Coverage by File

### `packages/ai-core/src/agents/nudge-agent.ts`
Tested via `nudge-agent.test.ts` (MOCK_AI=true path + AI path robustness).

- Mock mode: hasNudge:true + correct habit names (AC-6) ✅
- Mock mode: hasNudge:false + empty habits[] when ctx.habits=[] ✅
- Message references userName and habit names ✅
- Output shape invariants (hasNudge, message, habits) ✅
- AI path: parses valid JSON from mocked chat ✅
- AI path: parses ```json fenced output correctly ✅
- AI path: invalid/malformed JSON → fallback to mock, never throws (AC-7) ✅
- Empty habits backstop: returns hasNudge:false without calling LLM ✅
- NudgeOutput type contract ✅

**Estimated coverage: ~90%** (parse-failure branch, empty-message branch, and happy AI path all exercised via mocks)

### `apps/web/src/lib/habit-streak.ts`
Tested via `habit-streak.test.ts` (Prisma mocked via global setup).

- Returns [] when no active daily habits ✅
- Does NOT call habitLog.findMany when no active daily habits ✅
- Habit with no completed log on either day → broken (OQ-3/AC-1) ✅
- Correct NudgeHabit shape: { name, category, icon, streak } ✅
- Habit with completed log today → NOT broken ✅
- Habit with completed log yesterday → NOT broken ✅
- Mixed case: some broken, some not → only broken returned ✅
- Query scoped to userId + isActive:true + frequency:"daily" ✅
- habitLog.findMany scoped to userId + completed:true ✅
- Single habitLog.findMany call (no N+1) ✅
- Date query uses gte + lt (half-open range) ✅
- gte < lt (valid range invariant) ✅
- Timezone parameter accepted (string and null) ✅
- select: { habitId: true } (minimal fetch) ✅

**Estimated coverage: ~95%**

### `apps/web/src/app/api/ai/streak-nudge/route.ts`
Tested via `streak-nudge-route.test.ts` (findBrokenStreakHabits mocked at module level, generateStreakNudge mocked via vi.mock).

- 401 when requireUser throws (body has error: "Unauthorized") ✅
- findBrokenStreakHabits not called when auth fails ✅
- No broken habits → { hasNudge: false } HTTP 200, AI NOT called (AC-2) ✅
- No broken habits response has habits:[] and message:'' ✅
- Happy path: HTTP 200, NudgeOutput returned flat (not { report: ... }) ✅
- Happy path: body matches agent output exactly ✅
- generateStreakNudge called exactly once ✅
- userName from user.name passed to context ✅
- Falls back userName to "there" when user.name is null ✅
- Broken habits array passed to agent context ✅
- Agent throw → HTTP 200 (not 5xx), { hasNudge: false } (NFR-2/AC-7) ✅
- Non-Error throw → HTTP 200, { hasNudge: false } ✅
- Error fallback body has habits:[] and message:'' ✅
- Timeout → HTTP 200 (not 5xx or 504), { hasNudge: false } (NFR-2/AC-7) ✅

**Estimated coverage: ~95%** (all branches including auth, backstop, happy path, error, timeout)

### `apps/web/src/components/dashboard/streak-nudge-card.tsx`
Tested via `streak-nudge-card.test.ts` (node env, no DOM — logic/helper extraction pattern mirroring weekly-review-card.test.ts).

- dismissKey helper: correct format `sb_streak_nudge_dismissed:YYYY-MM-DD` ✅
- dismissKey produces different keys for different dates ✅
- shouldRender: returns true when hasNudge:true, not dismissed, nudge present ✅
- shouldRender: returns false when hasNudge:false ✅
- shouldRender: returns false when nudge is null ✅
- shouldRender: returns false when dismissed=true ✅
- localStorage gate: gated when today's key present (AC-5) ✅
- localStorage gate: NOT gated when absent or only yesterday's key present ✅
- Dismiss action: sets dismissed=true (AC-4) ✅
- Dismiss action: writes dismiss key to localStorage (AC-5) ✅
- Dismiss action: localStorage value is "1" ✅
- Post-dismiss: shouldRender returns false ✅
- Post-dismiss: isGatedByLocalStorage returns true ✅
- Fetch skip simulation: no fetch when gated, fetch when not gated ✅
- Habit list display: shown when habits non-empty, hidden when empty ✅
- NudgeOutput type contract ✅

**Estimated coverage: ~80%** (pure logic tested; actual useEffect/useState lifecycle, fetch call, and JSX render excluded per node-env pattern)

---

## Full Suite Result

- Before new tests: N/A (branch state)
- After new tests: **58 test files, 1073 tests, 0 failures** ✅
- TypeScript: `npx tsc --noEmit` — **clean, 0 errors** ✅

---

## Deliberate Exclusions

| What | Reason |
|------|--------|
| JSX rendering / DOM interactions in StreakNudgeCard | Project uses Vitest in node env (no jsdom); component smoke tests use the logic-extraction pattern as established by `weekly-review-card.test.ts` and `goal-conflict-card.test.ts` |
| Real `userDayRange` UTC value assertions | Timezone-sensitive; system is IST (+5:30), which would make the exact UTC millisecond non-portable. Replaced with structural assertions (instanceof Date, gte < lt) |
| Real AI provider calls | All AI paths use MOCK_AI=true or vi.mock — no external calls in CI |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Only a 2-line insertion of `<StreakNudgeCard />`; no logic to test independently |

---

## Bug Fixes During Testing

None. The implementation was clean; no source bugs found.

One test fix was needed: the initial `gte < TODAY` date assertion was timezone-sensitive (IST+5:30 caused the computed UTC gte to appear after the fixture `TODAY = 2026-06-27T00:00:00.000Z`). Fixed by replacing exact UTC comparisons with structural assertions (instanceof Date, gte < lt invariant).
