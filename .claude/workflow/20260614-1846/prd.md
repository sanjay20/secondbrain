# PRD: Affirmations Feature (SB-30)

**Jira:** https://sanjay-sahare.atlassian.net/browse/SB-30
**Epic:** SB-27 — Mindset Pillar (mental wellness tracking)
**Priority:** Medium
**Status:** To Do

---

## Summary

Add a personal Affirmations tab to the Mindset page where users can create and manage custom affirmations, with a randomly rotating daily affirmation displayed on the dashboard.

---

## Problem Statement

Users of the SecondBrain app currently track mood and gratitude in the Mindset module but have no way to create and revisit personal affirmations — short positive statements that reinforce beliefs and intentions. Without a dedicated affirmations feature, users miss a key mental wellness practice. Adding affirmations alongside Gratitude gives users a daily positive reinforcement loop that complements mood tracking.

---

## Requirements

### Functional

- [ ] FR-1: Users can create custom affirmations (text-based, 1–200 characters).
- [ ] FR-2: Users can view all their affirmations in a list on the Affirmations tab under the Mindset page.
- [ ] FR-3: Users can delete their own affirmations.
- [ ] FR-4: A single affirmation is randomly selected and displayed as a "Daily Affirmation" widget on the dashboard.
- [ ] FR-5: The randomly shown affirmation rotates — a new one is picked on each dashboard load (or daily, from the user's saved list).
- [ ] FR-6: The Affirmations feature is presented as a new tab ("Affirmations") beside the existing Gratitude tab on the Mindset page.
- [ ] FR-7: If the user has no affirmations saved, the dashboard widget shows a prompt to add one; the Affirmations tab shows an empty state.

### Non-Functional

- [ ] NFR-1: All DB queries are scoped to `userId` — no cross-user data leakage.
- [ ] NFR-2: Input validated server-side with Zod (min 1 char, max 200 chars).
- [ ] NFR-3: API routes follow the same pattern as `/api/gratitude` (Clerk auth via `requireUser`, Prisma, Zod).
- [ ] NFR-4: UI follows the existing `glass` card / Tailwind design system used in the Mindset module.
- [ ] NFR-5: TypeScript strict mode — `npx tsc --noEmit` must pass after implementation.

---

## Acceptance Criteria

- [ ] AC-1: Given a logged-in user on the Mindset page, when they click the "Affirmations" tab, then they see a form to add a new affirmation and a list of their existing affirmations.
- [ ] AC-2: Given a user types text (1–200 chars) and submits the form, when the POST succeeds, then the new affirmation appears in the list immediately (optimistic or refetch).
- [ ] AC-3: Given a user clicks delete on an affirmation, when confirmed, then the affirmation is removed from the list and the DB.
- [ ] AC-4: Given a user has at least one affirmation, when they visit the dashboard, then a "Daily Affirmation" card is visible showing one of their affirmations chosen randomly.
- [ ] AC-5: Given a user has no affirmations, when they visit the dashboard, then the Daily Affirmation card is hidden or shows a link to add one.
- [ ] AC-6: Given an empty affirmations list, when a user opens the Affirmations tab, then a friendly empty state message is shown ("Add your first affirmation to get started").
- [ ] AC-7: Given invalid input (empty or > 200 chars), when the user submits, then a validation error is shown and no DB write occurs.

---

## Out of Scope

- AI-generated affirmations (not in this ticket; may come in a future SB ticket).
- Scheduled push notifications / reminders for affirmations.
- Affirmation categories or tags.
- Streak tracking for affirmations (unlike Gratitude, no daily limit or streak mechanic required per the ticket).
- Editing existing affirmations (delete + re-add pattern is sufficient for v1).

---

## Implementation Notes (for Planner)

The Gratitude feature is the direct precedent for this implementation:

| Layer | Gratitude (existing) | Affirmations (new) |
|-------|---------------------|---------------------|
| DB model | `GratitudeEntry` in `schema.prisma` | `Affirmation` model — `id`, `userId`, `text`, `createdAt` |
| API | `/api/gratitude` (GET/POST), `/api/gratitude/[id]` (DELETE) | `/api/affirmations` (GET/POST), `/api/affirmations/[id]` (DELETE) |
| Components | `gratitude-panel.tsx`, `gratitude-form.tsx`, `gratitude-list.tsx` | `affirmation-panel.tsx`, `affirmation-form.tsx`, `affirmation-list.tsx` |
| Page | `mindset/page.tsx` — add "Affirmations" tab | Same file, add 3rd tab |
| Dashboard | No affirmation widget today | Add `DailyAffirmation` card to dashboard sidebar |
| Types | `GratitudeEntry` in `@secondbrain/types` | Add `Affirmation` type |

The random daily affirmation on the dashboard: fetch all user affirmations from DB in `getDashboardData()`, pick one at random server-side (Math.random), pass it as a prop. This keeps the dashboard server-rendered.

---

## Open Questions

1. **Rotation cadence**: The ticket says "affirmations rotate randomly" but doesn't specify if this is per page load or once per day (pinned). Assumption: random on each dashboard page load (simpler, no extra state needed).
2. **Max affirmations per user**: No limit stated. Assumption: no hard limit for v1 (unlike Gratitude's 3/day cap). Add a reasonable soft cap (e.g. 50) enforced server-side if needed.
3. **Affirmation text length**: No length specified. Assumption: min 1 char, max 200 chars (consistent with typical affirmation length).
4. **Dashboard widget placement**: No UI mockup provided. Assumption: add a new `DailyAffirmation` card to the dashboard right-sidebar, similar to Today's Tasks and Today's Habits cards.
