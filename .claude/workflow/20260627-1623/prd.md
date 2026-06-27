# PRD — SB-45: Streak Motivation Nudges

**Ticket:** SB-45  
**Epic:** SB-40 — AI Cross-Pillar Features  
**Priority:** Medium  
**Status:** To Do  
**Labels:** ai, cross-pillar, module-habits, prio-medium  

---

## Summary

Add an AI-powered "streak motivation nudge" feature that detects when a user has broken a habit streak for 2 or more consecutive days and surfaces a short, personalised motivational message on the dashboard. This is implemented as a new `nudge-agent.ts` in the `ai-core` package and a corresponding dashboard card, following the established agent + card pattern used by Goal Conflict, Weekly Review, and Daily Briefing.

---

## Problem Statement

Users who track daily habits in SecondBrain can lose momentum silently — the app currently shows streak data but never proactively re-engages the user when a streak breaks. Without a timely prompt, small lapses turn into habit abandonment. This feature closes that loop: when the AI notices a habit has been missed for 2+ days it generates a warm, personalised nudge to help the user get back on track.

---

## Requirements

### Functional

**FR-1 — Streak-break detection**  
The system must query the `HabitLog` table (joined with `Habit`) for the authenticated user and identify every active habit (`isActive = true`) that has no `completed = true` log entry for the last 2 or more consecutive calendar days (relative to today's UTC date).

**FR-2 — Nudge generation (AI agent)**  
A new `nudge-agent.ts` in `packages/ai-core/src/agents/` must accept a `NudgeContext` (user name, list of broken-streak habits with streak length, habit name, category, icon) and call the LLM (via the existing `chat()` + `getChatConfig()` pattern) to produce a `NudgeOutput`:
- `hasNudge: boolean` — true when at least one streak is broken
- `message: string` — 2–3 sentence personalised motivational message referencing the specific habit(s) by name
- `habits: string[]` — names of the habits that triggered the nudge

**FR-3 — Mock mode**  
When `shouldMockAI()` returns true the agent must return a deterministic `NudgeOutput` without calling the LLM (consistent with every other agent in ai-core).

**FR-4 — API route**  
A new `POST /api/ai/streak-nudge` route in `apps/web/src/app/api/ai/streak-nudge/route.ts` must:
- Authenticate the request (NextAuth session).
- Query the DB for broken-streak habits.
- Call `generateStreakNudge(ctx)`.
- Return `NudgeOutput` as JSON with appropriate HTTP status codes.

**FR-5 — Dashboard card**  
A new `StreakNudgeCard` component in `apps/web/src/components/dashboard/streak-nudge-card.tsx` must:
- Call `POST /api/ai/streak-nudge` on mount.
- Render nothing (or remain hidden) when `hasNudge = false`.
- When `hasNudge = true`, display the motivational message and the list of affected habit names with their icons.
- Provide a "Got it" / dismiss button that hides the card for the session (no persistence needed for MVP).

**FR-6 — Dashboard integration**  
The `StreakNudgeCard` must be inserted into the main dashboard page below the `GoalConflictCard`, consistent with the existing card layout.

**FR-7 — Rate limiting / deduplication**  
To avoid nudge fatigue, the API route must not generate a new nudge more than once per user per calendar day. Implementation: check if a nudge was already generated today (can be done client-side via `sessionStorage` key or a lightweight server-side timestamp; pick the simplest approach — sessionStorage is acceptable for MVP).

### Non-Functional

**NFR-1 — Performance**  
The `POST /api/ai/streak-nudge` response should complete within 5 seconds (p95) when calling the LLM; LLM latency is expected to be the bottleneck.

**NFR-2 — Failure resilience**  
If the LLM call fails or returns unparseable JSON, the route must return `hasNudge: false` silently (no error exposed to the UI) — same fallback pattern as goal-conflict-agent.

**NFR-3 — No schema migration needed**  
Streak detection derives purely from existing `HabitLog` and `Habit` tables. No new DB columns or migrations are required.

**NFR-4 — Test coverage**  
Unit tests for `nudge-agent.ts` (mock mode + output shape) and integration tests for the API route, following the existing pattern in `apps/web/src/__tests__/api/`.

---

## Acceptance Criteria

**AC-1 — Streak break detected**  
Given a user has an active habit with no completed log for the past 2+ calendar days,  
When the dashboard loads and calls `POST /api/ai/streak-nudge`,  
Then the response contains `hasNudge: true`, a non-empty `message` mentioning the habit by name, and the habit listed in `habits[]`.

**AC-2 — No nudge when streaks are intact**  
Given all of the user's active habits have been completed within the last 1 day,  
When `POST /api/ai/streak-nudge` is called,  
Then the response contains `hasNudge: false` and the dashboard card does not render.

**AC-3 — Card renders on dashboard**  
Given `hasNudge: true` is returned,  
When the dashboard page is loaded,  
Then the `StreakNudgeCard` is visible below the `GoalConflictCard` with the motivational message.

**AC-4 — Dismiss works**  
Given the nudge card is visible,  
When the user clicks "Got it",  
Then the card disappears for the remainder of the session (no nudge on soft-refresh during the same session).

**AC-5 — Once-per-day rate limit**  
Given the user has already triggered and dismissed the nudge today,  
When the dashboard page is hard-refreshed (new session, same calendar day),  
Then the nudge card does not re-appear (assuming server-side or `localStorage`-based daily gate; clarify in implementation).

**AC-6 — Mock mode returns valid shape**  
Given `MOCK_AI=true` (or equivalent env flag),  
When `generateStreakNudge()` is called with a broken-streak context,  
Then it returns a well-formed `NudgeOutput` without making any LLM call.

**AC-7 — Graceful LLM failure**  
Given the LLM call throws or returns invalid JSON,  
When `POST /api/ai/streak-nudge` is called,  
Then the route returns `{ hasNudge: false }` and does not surface a 5xx to the client.

---

## Out of Scope

- Push notifications (browser or mobile) — ticket mentions this as an option but dashboard delivery is sufficient for MVP.
- Email or SMS delivery.
- Persisting nudge history to the database.
- Per-habit snooze preferences.
- Nudges for habits with `frequency !== 'daily'` (weekly habits have different streak semantics — exclude from MVP).

---

## Open Questions

**OQ-1 — Rate limit storage:** AC-5 assumes some persistence of "nudge shown today". The simplest MVP is `localStorage` (persists across sessions on same browser). If the user switches devices this won't carry over — acceptable for MVP? Assumption: yes, localStorage is fine for now.

**OQ-2 — Multi-habit nudge:** If 3 habits are all broken, does the message address all 3 individually or pick the highest-streak-loss habit? Assumption: the LLM prompt is given all broken habits and it naturally groups them into one message (following the briefing-agent pattern).

**OQ-3 — Exactly 2 days vs. "at least 2 days":** The ticket says "2+ days". Assumption: "at least 2 consecutive days" — i.e., today and yesterday both missing a completed log.

**OQ-4 — Notification delivery (post-MVP):** The ticket mentions "notification" as an alternative to the dashboard card. This is deferred post-MVP pending a notification infrastructure decision.
