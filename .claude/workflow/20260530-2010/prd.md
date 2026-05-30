# PRD: SB-37 — 5-Year Life Goals

**Ticket:** SB-37  
**Epic:** SB-36 — Vision Board Pillar  
**Priority:** High (labelled `prio-high` in Jira)  
**Status:** To Do  
**Date:** 2026-05-30  

---

## Summary

Allow users to define one 5-year goal per life pillar (career, wealth, health, knowledge, etc.) within the Vision Board, link each 5-year goal to monthly milestone goals, and surface those goals during the monthly life review so progress can be assessed.

---

## Problem Statement

Users currently have a generic Vision Areas board (free-form `name` + `statement` per area) that captures broad aspirations but provides no structured long-term goal-setting mechanism. Without explicit 5-year goals tied to each life pillar, users cannot:

1. Commit to a concrete, time-bound outcome for each life area.
2. Break that 5-year outcome into actionable shorter-horizon monthly goals.
3. Review progress against the long-term direction during a monthly life review.

The result is a vision board that feels inspirational but doesn't bridge to actual behaviour change. This story introduces structured 5-year goal records per pillar and the linking mechanism to monthly goals and the monthly life review.

---

## Requirements

### Functional

- [ ] **FR-1 — 5-year goal per pillar:** A user can create one 5-year goal for each life pillar. Life pillars are: `career`, `wealth`, `health`, `knowledge`, `relationships`, `personal`. Each goal stores: pillar (enum), goal text (string, required), target year (int, default = current year + 5), progress (0–100 int), and notes (optional string).
- [ ] **FR-2 — One goal per pillar constraint:** The system enforces at most one active 5-year goal per pillar per user. Attempting to add a second while one is active results in a validation error; the user must archive the existing goal first.
- [ ] **FR-3 — Monthly goal linking:** A monthly goal (new lightweight model `MonthlyGoal`) can be linked to a 5-year goal via a `fiveYearGoalId` foreign key. A single 5-year goal can have many monthly goals.
- [ ] **FR-4 — Monthly goal CRUD:** Users can create, read, update, and delete monthly goals. Each monthly goal stores: title (string), fiveYearGoalId (FK), month (YYYY-MM string or Date), status (`todo` / `in_progress` / `done`), and notes (optional string).
- [ ] **FR-5 — Monthly life review integration:** The monthly life review screen (new page or tab under Vision) aggregates: the list of active 5-year goals, their linked monthly goals for the current month, and each monthly goal's completion status. Users can mark monthly goals complete directly from the review view.
- [ ] **FR-6 — Progress roll-up:** A 5-year goal's `progress` (0–100) is editable manually by the user, and the UI also shows the percentage of linked monthly goals completed (computed client-side) as a secondary indicator.
- [ ] **FR-7 — Vision board display update:** The existing Vision Board page (`/vision`) is extended (or a new tab "5-Year Goals" is added) to show the 5-year goal cards alongside (or instead of) the generic VisionArea cards. Each card shows: pillar icon, goal text, target year, progress bar, count of linked monthly goals, and a link to add/view monthly goals.
- [ ] **FR-8 — AI insight integration:** The existing `vision-agent` is updated to include 5-year goal data when generating insights, surfacing alignment or gaps between the user's 5-year commitments.

### Non-Functional

- [ ] **NFR-1 — Auth scoping:** Every DB query includes a `userId` filter; no cross-user data leakage.
- [ ] **NFR-2 — Input validation:** All API inputs validated with Zod schemas (consistent with existing `goals/route.ts` and `vision/route.ts` patterns).
- [ ] **NFR-3 — Type safety:** All new models have corresponding TypeScript interfaces in `packages/types/src/index.ts`.
- [ ] **NFR-4 — Typecheck passes:** `cd apps/web && npx tsc --noEmit` must pass after all changes.
- [ ] **NFR-5 — Loading & empty states:** All new UI screens handle loading skeletons and empty-state prompts consistent with existing pages (career, vision).
- [ ] **NFR-6 — Size:** This is a feature (> 1 day). Estimated size: M (2–3 days).

---

## Acceptance Criteria

- [ ] **AC-1 — Add a 5-year goal per pillar:**  
  Given I am on the Vision Board page,  
  When I click "Add 5-year goal" and choose the "Career" pillar,  
  Then a new 5-year goal record is created for that pillar and displayed on the Vision Board.

- [ ] **AC-2 — One active goal per pillar:**  
  Given I already have an active 5-year goal for the "Wealth" pillar,  
  When I attempt to add another 5-year goal for "Wealth",  
  Then the system returns a 409 error and the UI shows "Archive your existing Wealth goal before adding a new one."

- [ ] **AC-3 — Link a monthly goal to a 5-year goal:**  
  Given I have a 5-year goal for "Health",  
  When I create a monthly goal with title "Run 3x per week", month "2026-06", and link it to the Health 5-year goal,  
  Then the monthly goal appears in the 5-year goal's detail view under "Monthly milestones."

- [ ] **AC-4 — Monthly life review surfaces linked goals:**  
  Given it is the monthly review and I have 5-year goals with linked monthly goals for the current month,  
  When I open the Monthly Life Review view,  
  Then each pillar's 5-year goal is shown alongside its monthly goals for the current month, each with a status checkbox.

- [ ] **AC-5 — Mark monthly goal complete in review:**  
  Given the Monthly Life Review is open,  
  When I tick the checkbox on a monthly goal,  
  Then the monthly goal's status updates to "done" and the change is persisted.

- [ ] **AC-6 — Progress indicator:**  
  Given I have a 5-year goal with 4 linked monthly goals, 2 of which are "done",  
  When I view the 5-year goal card,  
  Then I see "2 / 4 monthly goals completed (50%)" alongside the manually set progress bar.

---

## Out of Scope

- SB-38 (Bucket List) and SB-39 (Values and Identity) — separate stories under the same epic.
- The generic `VisionArea` model (from the previous SB-36 run) is kept as-is; this story does not remove it.
- Email/push reminders for monthly goal deadlines — handled by the existing Reminders module if needed later.
- Sharing or exporting 5-year goals publicly.
- Real-time collaborative editing.
- AI auto-generation of 5-year goals or monthly goals.

---

## Open Questions

- **OQ-1 — Pillar enum vs free text:** The ticket says "per pillar" but does not enumerate which pillars are valid. **Assumption:** use a fixed enum `career | wealth | health | knowledge | relationships | personal` consistent with the existing `Task.pillar` approach (which uses `knowledge | career | finance | habits`). The enum can be expanded later. The Vision Board already uses free-form `VisionArea.name`; 5-year goals are structured on top of that.

- **OQ-2 — Monthly life review location:** The ticket mentions "reviewed in monthly life review" but there is no existing `MonthlyReview` model or page. **Assumption:** Add a new "Monthly Review" tab or section within the `/vision` page (no separate `/monthly-review` route in this story). This is the minimal implementation that satisfies the AC without requiring a brand-new pillar page.

- **OQ-3 — Relationship to existing `VisionArea`:** The previous SB-36 run created `VisionArea` (free-form `name + statement + emoji + color`). **Assumption:** 5-year goals are a separate, structured model (`FiveYearGoal`) that does NOT replace VisionArea. The Vision Board page gains a new tab "5-Year Goals" that renders `FiveYearGoal` cards, while the existing "Vision Areas" tab renders `VisionArea` cards.

- **OQ-4 — Manual progress vs computed progress:** The ticket does not specify whether progress is manual or auto-calculated. **Assumption:** Both — a manual 0-100 slider (consistent with the `Goal` model), plus a secondary computed metric (monthly goals done / total) shown as text. The manual value is what is persisted.

- **OQ-5 — MonthlyGoal model scope:** Monthly goals could be generic (not tied to 5-year goals). **Assumption for this story:** `MonthlyGoal` is Vision-pillar-scoped and always has a `fiveYearGoalId`. Generic monthly planning (cross-pillar) is out of scope and may be addressed in a separate story.
