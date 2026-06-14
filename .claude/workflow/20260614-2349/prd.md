## Summary
Add a workout logging feature to the Health page so users can record daily exercise sessions and track their fitness progress over time.

## Jira Ticket
SB-4 — "Workout log"
Parent epic: SB-3 — "Health Pillar — full wellness management"
Priority: High
Labels: health, prio-high, tracking

## Problem Statement
Users of SecondBrain want a holistic view of their wellness. Currently the Health page only tracks habits. There is no way for users to log specific workout sessions (e.g., "ran 30 min today") or see how consistently they are exercising week over week. Without workout logging, users must rely on external apps, causing context-switching and reducing engagement with SecondBrain as a single life-management platform.

**Who is affected:** Health-conscious SecondBrain users who exercise regularly and want to see fitness data alongside their habits and other life metrics.

## Requirements

### Functional
- [ ] FR-1: User can create a workout entry with the following fields:
  - `type` — free-text workout label (e.g., "Running", "Strength", "Yoga"); required, max 50 characters
  - `duration` — duration in minutes (positive integer)
  - `notes` — optional free-text notes (up to 500 characters)
  - `date` — date of the workout (defaults to today, user-editable)
- [ ] FR-2: Workout entries are displayed in a list on the Health page in reverse chronological order (newest first)
- [ ] FR-3: A summary widget shows the **weekly workout count** (number of workouts logged in the current week, Mon–Sun)
- [ ] FR-4: User can delete a workout entry
- [ ] FR-5: API routes are protected with Clerk auth; all DB queries are scoped to the authenticated `userId`
- [ ] FR-6: Form validation prevents submission of entries with missing/blank type, type exceeding 50 characters, invalid duration (≤ 0 or non-numeric), or notes exceeding 500 characters

### Non-Functional
- [ ] NFR-1: Workout entries load within 500 ms on typical connections (paginated to 50 entries per page)
- [ ] NFR-2: All inputs validated server-side with Zod before DB write
- [ ] NFR-3: The workout section follows the same visual design as the existing habits section (glass cards, dark theme, Lucide icons)
- [ ] NFR-4: TypeScript strict mode — no `any` types; `tsc --noEmit` must pass

## Acceptance Criteria
- [ ] AC-1: Given I am on the Health page, When I click "Log Workout", Then a form/modal appears with fields for type (free-text input, max 50 chars), duration (number input), date (date picker, default today), and notes (textarea)
- [ ] AC-2: Given I submit a valid workout entry, When the save completes, Then the new entry appears at the top of the workout list without a page reload
- [ ] AC-3: Given there are workouts logged this week (Mon–Sun), When I view the Health page, Then the weekly summary card shows the correct count
- [ ] AC-4: Given I submit a workout with duration = 0 or empty type, When I try to save, Then the form shows an inline validation error and does not submit
- [ ] AC-5: Given I am logged out, When I call GET/POST/DELETE on `/api/workouts`, Then I receive a 401 response
- [ ] AC-6: Given I delete a workout entry, When the deletion completes, Then the entry is removed from the list without a page reload
- [ ] AC-7: Given more than 50 workout entries exist, When the list loads, Then only the 50 most recent are shown (pagination or "load more" not required for MVP)

## Out of Scope
- Workout editing (update an existing entry) — can be added in a follow-up
- Calories / calorie tracking
- Integration with Apple Health, Fitbit, Strava, or other fitness APIs
- Workout streaks or badges
- AI coach insights specific to workouts (the existing AI health insight can incorporate workouts generically)
- Charts or trend graphs (beyond the weekly count summary card)
- Social / sharing features

## Resolved Decisions (PRD gate)
- Q1: `type` is **free-text** (required, max 50 chars) — not a fixed dropdown.
- Q2: Size confirmed **M** (2–3 days) — DB model + API routes + UI list + form + summary card.
- Q3: Workouts live on the **same Health page** as a new "Workouts" section below the habits list (not a separate sub-tab).
- Q4: `date` is **user-editable**, defaulting to today (users may log past workouts).

## Technical Notes (for Planner)
- **DB**: New `Workout` model needed in `packages/db/prisma/schema.prisma` (fields: id, userId, type, duration, notes, date, createdAt)
- **API**: New routes at `apps/web/src/app/api/workouts/route.ts` (GET, POST) and `apps/web/src/app/api/workouts/[id]/route.ts` (DELETE)
- **UI**: New components `WorkoutLog` (list) and `WorkoutForm` (add form) under `apps/web/src/components/health/`
- **Page**: Health page (`apps/web/src/app/(dashboard)/health/page.tsx`) needs the new workout section integrated
- **Types**: Add `Workout` type to `packages/types/`
- **Pattern**: Follow the habits implementation as the reference pattern (HabitCard → WorkoutCard, HabitForm → WorkoutForm, `/api/habits` → `/api/workouts`)
