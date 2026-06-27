# PRD: Monthly Life Score (SB-44)

**Jira:** [SB-44](https://sanjay-sahare.atlassian.net/browse/SB-44)
**Epic:** SB-40 — AI Cross-Pillar Features
**Priority:** Medium
**Status:** To Do
**Date:** 2026-06-27

---

## Summary

An AI-powered feature that scores each of the user's six life pillars (career, wealth, health, knowledge, relationships, personal) on a 1–10 scale each month. The score is derived from the user's real data stored in SecondBrain (habits, goals, workouts, journal entries, transactions, etc.), accompanied by a brief AI-written explanation and a trend indicator versus the prior month. A spider/radar chart provides an at-a-glance view of balance across all pillars.

---

## Problem Statement

Users invest effort logging data across multiple life domains in SecondBrain, but currently lack a unified, synthesised view of how they are performing across all pillars. Without a monthly score, users cannot quickly identify which areas are thriving, which are lagging, or whether they are improving over time. This feature closes that gap by turning raw multi-domain data into a single, actionable monthly health check.

---

## Requirements

### Functional

**FR-1 — AI Pillar Scoring**
The system shall compute a 1–10 score for each of the six pillars (career, wealth, health, knowledge, relationships, personal) once per scoring run, using data logged by the user during that calendar month.

**FR-2 — Data Sources Per Pillar**
Each pillar shall aggregate the following data to inform the AI:
- **health:** HabitLog entries (habit streaks/completion %), Workout logs, MoodLog entries
- **wealth:** WealthAccount balances, Transaction records, Investment valuations, SavingsGoal progress
- **career:** Goal completions, Task completions, TimeBlock logs, SkillGoal progress
- **knowledge:** Skill progress (SkillGoal), JournalEntry tags related to learning
- **relationships:** GratitudeEntry mentions, JournalEntry content referencing relationships
- **personal:** Affirmation completion, CoreValue alignment notes, BucketListItem progress, JournalEntry sentiment

**FR-3 — Short Explanation Per Score**
Each pillar score shall be accompanied by a 2–4 sentence AI-generated explanation summarising why that score was given, referencing specific data signals where possible.

**FR-4 — Trend vs Previous Month**
Each pillar shall display a trend indicator (up / down / flat) and the numeric delta (e.g. +1.5) compared to the prior month's stored score. If no prior month score exists, display "No previous data".

**FR-5 — Radar / Spider Chart**
A radar (spider) chart shall visualise all six pillar scores simultaneously, rendered client-side in the dashboard. The chart shall be interactive (hover shows label + score).

**FR-6 — On-Demand Scoring Trigger**
Scoring shall be triggered on-demand by the user (e.g. a "Generate Monthly Score" button), consistent with how other AI features in SecondBrain work (e.g. Weekly Review, Goal Conflict Detector). The system shall target the current calendar month unless the user selects a past month.

**FR-7 — Score Persistence**
Each scoring run result (all six pillar scores + explanations + run timestamp + month/year) shall be persisted in a new `MonthlyLifeScore` database model so that trend data and history are available.

**FR-8 — Dashboard Card**
A new `MonthlyLifeScoreCard` component shall be added to the dashboard, displaying the radar chart, individual pillar scores with trend, and a trigger button. It shall sit in the dashboard alongside existing AI cards (Daily Briefing, Goal Conflict).

**FR-9 — Month Selector**
The card shall allow the user to select a past month (up to 12 months back) to view historical scores if they have been generated.

**FR-10 — Loading & Error States**
The card shall show a loading skeleton while the AI is computing, and a user-friendly error message if the API call fails.

### Non-Functional

**NFR-1 — Response Time**
The AI scoring API shall respond within 30 seconds for a full six-pillar run (p95). Scoring all pillars in a single AI call (batch) is preferred over six sequential calls.

**NFR-2 — Model**
Shall use the project-standard Anthropic model (currently Opus per the Opus global trial; revisit ~2026-07-03).

**NFR-3 — Auth & Isolation**
The API endpoint shall require authentication. Scores must be scoped to the authenticated user; no cross-user data leakage.

**NFR-4 — Graceful Sparse Data**
If a pillar has no data for the selected month, the AI shall still return a score (likely low, e.g. 1–3) with an explanation noting the absence of data, rather than erroring. The UI shall not block on missing data.

**NFR-5 — Accessibility**
The radar chart shall include an accessible data table fallback (screen reader friendly) showing pillar name, score, and trend.

**NFR-6 — Test Coverage**
Unit tests for the scoring agent, integration tests for the API route, and a smoke test for the dashboard card are required before merge.

---

## Acceptance Criteria

**AC-1 — Scores generated**
Given the user has data for the current month and clicks "Generate Monthly Score",
When the AI completes its analysis,
Then a 1–10 score is displayed for each of the six pillars: career, wealth, health, knowledge, relationships, personal.

**AC-2 — Explanation shown**
Given a score has been generated,
When the user views any pillar,
Then a 2–4 sentence explanation is shown beneath the score.

**AC-3 — Trend indicator**
Given the user has a score from the prior month persisted in the database,
When a new score is generated,
Then each pillar shows a numeric delta and an up/down/flat arrow vs the previous month.

**AC-4 — No prior month data**
Given this is the user's first scoring run,
When scores are generated,
Then the trend field displays "No previous data" and no delta number is shown.

**AC-5 — Radar chart renders**
Given scores have been generated,
When the dashboard card loads,
Then a spider/radar chart renders all six pillar scores simultaneously with hover labels.

**AC-6 — Sparse data handled**
Given a pillar has zero logged data for the selected month,
When scores are generated,
Then that pillar receives a score (not an error) with an explanation noting insufficient data.

**AC-7 — Scores persisted**
Given the user generates scores,
When the API returns successfully,
Then the results are stored in the `MonthlyLifeScore` table and remain accessible on page reload.

**AC-8 — Past month viewable**
Given the user has scores from a prior month,
When they select that month from the month picker,
Then the stored scores and radar chart for that month are displayed without re-triggering the AI.

**AC-9 — Auth enforced**
Given an unauthenticated request to the scoring API,
When the request arrives,
Then the API returns 401 and no data is processed.

---

## Out of Scope

- Automatic/scheduled monthly scoring (cron-triggered) — on-demand only for this iteration
- Push notifications when scores are ready
- Comparison across multiple users / social features
- Pillar weighting / user-defined importance multipliers
- PDF/email export of the monthly score report
- Sub-pillar breakdowns (e.g. "sleep" vs "exercise" within health)

---

## Open Questions

**OQ-1 — Month selector default:** Should the card default to the current calendar month or the most recently completed month? (Current month may have sparse data mid-month.) Assumption: current month, with a note in the UI that scores improve as more data is logged.

**OQ-2 — Re-generation:** If the user clicks "Generate" again for the same month, should it overwrite the stored score or create a versioned history? Assumption: overwrite (upsert), keeping only the latest score per user per month.

**OQ-3 — Placement on dashboard:** Should the Monthly Life Score card appear above or below the Goal Conflict card? Assumption: below Goal Conflict, since it is a monthly summary rather than an urgent alert.

**OQ-4 — Pillar data scope:** For pillars with ambiguous data (e.g. relationships uses JournalEntry content), should the AI receive raw journal text or only metadata? Privacy implication. Assumption: send only metadata (entry count, sentiment tag if present) to the AI, not raw journal content.
