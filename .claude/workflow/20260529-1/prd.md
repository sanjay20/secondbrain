# PRD — Journal Entry Reminders
**Run ID:** 20260529-1  
**Date:** 2026-05-29  
**Priority:** Medium  
**Size:** Full feature (multi-day)  
**Status:** In Progress  
**Jira:** [SB-1](https://sanjay-sahare.atlassian.net/browse/SB-1)  
**PR:** [#1](https://github.com/sanjay20/secondbrain/pull/1)

---

## Summary
Allow users to attach a single follow-up reminder to any journal entry. At the scheduled time the user receives a browser push notification and an email.

## Problem Statement
Journal entries currently have no scheduling mechanism. Events that require follow-up action (e.g. "Call Dr. Singh", "Check on production incident") can be forgotten because there is no reminder tied to the entry. The user has no way to surface a logged event at a future point in time.

## User Persona
The logged-in user — the person who created the journal entry. Reminders are personal and not shared.

## Happy Path
1. User opens a journal entry in the feed.
2. User clicks "Set reminder" on the entry.
3. A date + time picker appears. Future dates only.
4. User picks a date/time and confirms.
5. Entry shows a reminder badge (date/time) in the feed.
6. At the scheduled time:
   - A **browser push notification** fires (requires notification permission granted once).
   - An **email** is sent to the user's registered email address.
7. After the reminder fires it is marked as `sent`; the badge updates to show "Sent".

## Requirements

### Functional
- [ ] FR-1: Each journal entry may have at most one reminder (`null` = no reminder).
- [ ] FR-2: Reminder has a `scheduledAt` (datetime) and `status` (`pending` | `sent` | `cancelled`).
- [ ] FR-3: Setting a reminder with a past datetime is blocked (validation on client + server).
- [ ] FR-4: Deleting a journal entry cascades to delete its reminder.
- [ ] FR-5: User can cancel a pending reminder without deleting the entry.
- [ ] FR-6: User can update (reschedule) a pending reminder to a new future datetime.
- [ ] FR-7: Browser push: user is prompted for notification permission on first reminder set.
- [ ] FR-8: Email: sent via **Resend** (free tier, 3 000 emails/month). Email contains entry content, category, and a link back to the journal page.
- [ ] FR-9: Reminder delivery is handled by a **systemd timer** that calls a Next.js API route (`POST /api/reminders/process`) every minute.

### Non-Functional
- [ ] NFR-1: Missed reminders (server was down) fire within 1 minute of server coming back up.
- [ ] NFR-2: The processing route is protected — only callable from localhost or with a secret header, not publicly accessible.
- [ ] NFR-3: No duplicate sends — once status is `sent`, the processor skips it.

## Acceptance Criteria
- [ ] AC-1: Given a journal entry exists, when I click "Set reminder" and pick a future time, then a reminder badge appears on the entry.
- [ ] AC-2: Given a reminder is set, when I delete the entry, then the reminder is also gone (no orphan record).
- [ ] AC-3: Given a reminder is set, when I try to set a second reminder on the same entry, then the UI replaces (reschedules) the existing one rather than creating a second.
- [ ] AC-4: Given a reminder's `scheduledAt` has passed and status is `pending`, when the processor runs, then status becomes `sent`, a browser push fires, and an email is received.
- [ ] AC-5: Given I try to set a reminder in the past, then the date picker disables past datetimes and the API returns a 400 if attempted anyway.

## Technical Design Notes
- **New DB model:** `Reminder` — fields: `id`, `userId`, `journalEntryId` (unique, cascade delete), `scheduledAt`, `status`, `pushSubscription` (JSON, nullable), `createdAt`, `updatedAt`.
- **Email provider:** Resend (`resend` npm package). Needs `RESEND_API_KEY` + `FROM_EMAIL` env vars.
- **Browser push:** Web Push API with VAPID keys. Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` env vars. `web-push` npm package.
- **Scheduler:** `secondbrain-reminder.timer` systemd unit (every 1 min) calls `POST /api/reminders/process` with a `x-reminder-secret` header. Secret stored in `REMINDER_PROCESS_SECRET` env var.
- **New API routes:**
  - `POST /api/reminders` — create/update reminder on an entry
  - `DELETE /api/reminders/[id]` — cancel reminder
  - `POST /api/reminders/process` — internal, called by scheduler
  - `POST /api/push/subscribe` — save push subscription for current user

## Out of Scope
- Recurring reminders (e.g. "remind me every Monday")
- SMS notifications
- Reminder snooze
- Shared / delegated reminders

## Open Questions
- Should the email include a "Mark as done" action link, or just a link to the journal?
- If browser push permission is denied, should we fall back to email-only silently or warn the user?

## Dependencies
- `resend` npm package + Resend account (free tier)
- `web-push` npm package + VAPID key generation
- New `secondbrain-reminder.timer` + `secondbrain-reminder.service` systemd units
- `RESEND_API_KEY`, `FROM_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`, `REMINDER_PROCESS_SECRET` env vars
