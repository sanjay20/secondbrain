# PRD: Gratitude Log (SB-28)

**Jira:** [SB-28](https://sanjay-sahare.atlassian.net/browse/SB-28)  
**Epic:** SB-27 — Mindset Pillar — mental wellness tracking  
**Priority:** High  
**Type:** Story  
**Status:** To Do  
**Date:** 2026-06-14

---

## Summary

Allow users to record 1–3 daily gratitude items, view a monthly gratitude summary, and track a consecutive-day streak — all within the Mindset pillar.

---

## Problem Statement

Users who want to build a positive mindset habit currently have no dedicated tool in SecondBrain for gratitude journaling. The Mindset pillar already supports mood tracking (`MoodLog`), but gratitude requires a distinct, structured flow (multiple short items per day, not a single mood rating). Without this, users cannot reinforce a positivity habit inside their daily SecondBrain routine.

---

## Requirements

### Functional

- [ ] FR-1: A user can add between 1 and 3 gratitude items per day. Each item is a short free-text string (max 280 chars).
- [ ] FR-2: If a user already has 3 items for today, the "Add" button is disabled and a friendly message is shown ("You've logged your 3 gratitude items for today!").
- [ ] FR-3: A user can view all their gratitude entries for the current calendar month in a "Monthly Summary" section.
- [ ] FR-4: A streak counter shows the number of consecutive days the user has logged at least 1 gratitude item. The streak resets if a day is missed.
- [ ] FR-5: A user can delete an individual gratitude item added today (no editing; delete and re-add if needed).
- [ ] FR-6: Past days' entries (not today) are read-only — no deletion or editing.

### Non-Functional

- [ ] NFR-1: All DB queries are scoped to `userId` (Clerk auth, `requireUser()` pattern as used in `mood/route.ts`).
- [ ] NFR-2: All API inputs validated with Zod.
- [ ] NFR-3: Streak calculation must not require a full table scan; use an indexed query on recent entries.
- [ ] NFR-4: Page load should fetch only the current month's entries (date range filter) to keep response sizes small.
- [ ] NFR-5: No `use client` on the page shell if static layout is sufficient; interactive sections use client components.

---

## Acceptance Criteria

- [ ] AC-1: Given I am on the Gratitude page and have 0 items today, When I type a gratitude item and press "Add", Then the item appears in today's list.
- [ ] AC-2: Given I already have 3 items today, When I view the Gratitude page, Then the add form is hidden/disabled with a message "You've logged your 3 gratitude items for today!".
- [ ] AC-3: Given I have items for today, When I click the delete icon next to an item, Then it is removed and I can add a new one (until 3 are reached again).
- [ ] AC-4: Given I have logged at least 1 item every day for the past N consecutive days, When I view the page, Then the streak counter shows N.
- [ ] AC-5: Given the current month has multiple days with entries, When I view the Monthly Summary section, Then I can see all entries grouped by day for the current month.
- [ ] AC-6: Given a past day's entry, When I view it in the Monthly Summary, Then there are no delete/edit controls visible.

---

## Out of Scope

- Editing individual gratitude items (delete + re-add is sufficient for v1).
- Push/email reminders for gratitude (handled by the existing Reminders module if needed later).
- AI summarisation of gratitude themes (future enhancement).
- Sharing or exporting gratitude entries.
- Retroactive entry for past days (users can only log for today).

---

## Technical Notes

### New DB model (`GratitudeEntry`)

The existing `MoodLog` model (one row per user per day) cannot store multiple items per day. A new `GratitudeEntry` model is required:

```prisma
model GratitudeEntry {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  item      String   // max 280 chars enforced at API layer
  date      DateTime @db.Date  // stores only the calendar date
  createdAt DateTime @default(now())

  @@index([userId, date])
  @@map("gratitude_entries")
}
```

The `User` model must get a new relation field: `gratitudeEntries GratitudeEntry[]`.

### Streak calculation

Query the last 60 days of entries grouped by date, then walk backward from today counting consecutive days with at least 1 entry. This is O(60) and uses the existing `[userId, date]` index.

### API surface (`/api/gratitude`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gratitude` | Returns this month's entries + streak count |
| POST | `/api/gratitude` | Creates one entry for today (validates max 3/day) |
| DELETE | `/api/gratitude/[id]` | Deletes an entry (today only, owned by userId) |

### UI location

`/mindset/gratitude` — new page under the existing `(dashboard)/mindset/` directory, following the same structure as `(dashboard)/mindset/mood/page.tsx`.

A "Gratitude" link should be added to the mindset sidebar/navigation.

---

## Open Questions

- **Q1 (assumed):** Can users submit items at any time during the day (not just once)? *Assumption: Yes, up to 3 cumulative items per calendar day.*
- **Q2 (assumed):** What is the character limit per item? *Assumption: 280 characters (Twitter-length, easy to type on mobile).*
- **Q3 (assumed):** Is a streak broken if the user misses yesterday but logs today? *Assumption: Yes — streak resets to 1 on the next log after a missed day.*
- **Q4 (not in ticket):** Should the monthly summary scroll within the page or paginate? *Assumption: Single scrollable list for the current month only.*
- **Q5 (not in ticket):** Should the Mindset sidebar show "Gratitude" as a new nav item, or is it accessible only from within the Mindset page? *Assumption: Add a "Gratitude" nav link in the mindset section of the sidebar, consistent with how "Mood" is linked.*
