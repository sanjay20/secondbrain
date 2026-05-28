# SecondBrain — Agentic Development Workflow

A multi-agent pipeline that takes a feature idea from raw conversation all the way to a merged GitHub PR, with a human approval gate at each major stage.

---

## Overview

```
You (human)
    │
    │ describe idea / bug / task
    ▼
┌─────────────────┐
│  PM Agent       │  interviews you → writes PRD → creates Jira ticket(s)
└────────┬────────┘
         │ ticket key (e.g. SB-42)
         ▼
┌─────────────────┐
│  Planner Agent  │  reads Jira ticket → produces implementation plan (tasks + file map)
└────────┬────────┘
         │ plan.md
         ▼
┌─────────────────┐
│  Dev Agent      │  implements changes according to plan, runs typecheck
└────────┬────────┘
         │ diff
         ▼
┌─────────────────┐
│  Test Agent     │  writes / updates tests for changed code
└────────┬────────┘
         │ test files
         ▼
┌─────────────────┐     ┌──────────────────────┐
│  Review Agent   │────▶│  Reviewer Roles:      │
│  (orchestrator) │     │  • Architect          │
└────────┬────────┘     │  • Security           │
         │              │  • Performance        │
         │ review.md    │  • UX/API consistency │
         ▼              └──────────────────────┘
┌─────────────────┐
│  PR Agent       │  commits, pushes feature branch, opens GitHub PR
└─────────────────┘
```

Each agent runs as a Claude Code subagent (via the `Agent` tool) and writes its output to `.claude/workflow/<run-id>/` so the orchestrator and human can inspect every step.

---

## Prerequisites

### 1. Install `gh` CLI

```bash
# Ubuntu/Debian
sudo apt install gh

# Authenticate to GitHub
gh auth login
# choose: GitHub.com → HTTPS → browser
```

### 2. Add Jira credentials to `.env.local`

```bash
# .env.local additions
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=sanjay@example.com
JIRA_API_TOKEN=<token from https://id.atlassian.com/manage-profile/security/api-tokens>
JIRA_PROJECT_KEY=SB
```

### 3. Verify tools are accessible inside Claude Code

```bash
# These must all succeed:
gh --version
git --version
node --version
```

---

## Agent Definitions

### Agent 1 — PM Agent (`pm`)

**Role:** Product Manager. Conducts a structured interview, writes a Product Requirement Document (PRD), and creates a Jira issue.

**Input:** Free-text description of the feature/bug from the user.

**Output:**
- `.claude/workflow/<run-id>/prd.md` — full PRD
- `.claude/workflow/<run-id>/jira-ticket.json` — Jira issue payload
- Jira ticket URL printed to stdout

**Interview questions it asks:**
1. What problem does this solve for the user?
2. Who is the primary user / persona?
3. What is the expected behaviour? (happy path)
4. What are the edge cases or constraints?
5. Is this a small task (≤ 1 day) or a feature (> 1 day)?
6. Priority: critical / high / medium / low?
7. Any dependencies on other tickets or external services?

**Jira API call it makes:**
```
POST https://$JIRA_BASE_URL/rest/api/3/issue
Authorization: Basic base64($JIRA_EMAIL:$JIRA_API_TOKEN)
Content-Type: application/json
```

**PRD template it fills:**
```markdown
## Summary
One-sentence description.

## Problem Statement
Why this matters and who is affected.

## Requirements
### Functional
- [ ] FR-1: …
### Non-Functional
- [ ] NFR-1: …

## Acceptance Criteria
- [ ] AC-1: Given … When … Then …

## Out of Scope
- …

## Open Questions
- …
```

**Prompt to spawn this agent:**
```
You are the PM Agent for the SecondBrain project.
Your job is to:
1. Ask the user the 7 interview questions listed in AGENTIC_WORKFLOW.md one at a time.
2. After gathering answers, write a PRD following the template and save it to
   .claude/workflow/<run-id>/prd.md.
3. Create a Jira issue using the REST API (credentials in .env.local).
   Issue type: "Story" for features, "Bug" for bugs, "Task" for small tasks.
   Save the created issue JSON to .claude/workflow/<run-id>/jira-ticket.json.
4. Print the Jira ticket URL and key (e.g. SB-42) when done.

Feature description from user: "<paste user description here>"
Run ID: <timestamp e.g. 20260529-1430>
```

---

### Agent 2 — Planner Agent (`planner`)

**Role:** Tech Lead. Reads the PRD and Jira ticket, explores the codebase, and produces a detailed implementation plan.

**Input:** Jira ticket key (e.g. `SB-42`) and the PRD file path.

**Output:**
- `.claude/workflow/<run-id>/plan.md` — step-by-step implementation plan

**Plan structure it produces:**
```markdown
## Ticket: SB-42 — <title>

## Affected files
| File | Change type | Notes |
|------|-------------|-------|

## Implementation steps
1. Step description (file: …, ~lines)
2. …

## DB changes required?
Yes/No. If yes: schema change + prisma db push + prisma generate

## New packages required?
None / list with justification

## Test strategy
- Unit: what to test
- Integration: what to test

## Risk / unknowns
- …

## Estimated size
XS / S / M / L / XL
```

**Prompt to spawn this agent:**
```
You are the Planner Agent for the SecondBrain project.
Read KNOWLEDGE.md and AGENTIC_WORKFLOW.md in .claude/ to understand the architecture.
Read the PRD at .claude/workflow/<run-id>/prd.md.
Fetch the Jira ticket SB-<n> from Jira (credentials in .env.local) for context.
Explore the codebase to identify exactly which files need to change.
Write a detailed implementation plan to .claude/workflow/<run-id>/plan.md.
Do NOT write any code yet.
```

---

### Agent 3 — Dev Agent (`dev`)

**Role:** Senior Developer. Implements the changes described in the plan exactly.

**Input:** `.claude/workflow/<run-id>/plan.md`

**Output:**
- Code changes committed to a feature branch `feature/SB-<n>-<slug>`
- `.claude/workflow/<run-id>/dev-notes.md` — any decisions made during implementation

**Rules it follows:**
- One commit per logical unit (schema change, API, UI, etc.)
- Never commit `.env*` files
- Run `npx tsc --noEmit` after changes — must pass before declaring done
- If schema changed: run `prisma db push && prisma generate`
- No comments unless the WHY is non-obvious
- No extra abstractions beyond what the plan requires

**Prompt to spawn this agent:**
```
You are the Dev Agent for the SecondBrain project.
Read KNOWLEDGE.md and AGENTIC_WORKFLOW.md in .claude/ to understand the codebase.
Read the implementation plan at .claude/workflow/<run-id>/plan.md.
Create a feature branch: git checkout -b feature/SB-<n>-<slug>
Implement every step in the plan. After all changes:
  - Run: cd apps/web && npx tsc --noEmit  (must pass)
  - If schema changed: cd packages/db && npx prisma db push && npx prisma generate
  - Commit all changes with clear commit messages
Write a brief dev-notes.md to .claude/workflow/<run-id>/dev-notes.md summarising
any decisions you made that differ from the plan.
Do NOT push to remote yet.
```

---

### Agent 4 — Test Agent (`tester`)

**Role:** QA Engineer. Writes tests for every changed public function and API route.

**Input:** `plan.md` + the actual diff on the feature branch.

**Output:**
- Test files added/updated in the codebase
- `.claude/workflow/<run-id>/test-report.md` — what was tested and what wasn't

**Test targets by layer:**

| Layer | Test approach |
|-------|--------------|
| Utility functions (`lib/`, `packages/`) | Unit tests (Jest / Vitest) |
| API route handlers (`app/api/`) | Integration tests with mocked Prisma |
| AI agents (`packages/ai-core/agents/`) | Unit tests with `MOCK_AI=true` |
| UI components | Smoke tests (render + interaction) |

**Prompt to spawn this agent:**
```
You are the Test Agent for the SecondBrain project.
Read KNOWLEDGE.md and AGENTIC_WORKFLOW.md in .claude/.
Checkout branch feature/SB-<n>-<slug> and run: git diff main --name-only
For every changed file that contains public functions or API routes, write tests.
Use the project's existing test setup. If no test framework is configured yet,
install vitest + @testing-library/react and configure it minimally in apps/web.
Commit test files to the same branch.
Write .claude/workflow/<run-id>/test-report.md listing: what was tested, coverage
estimate, and anything deliberately excluded (with reason).
```

---

### Agent 5 — Review Agent (`reviewer`)

**Role:** Engineering lead who orchestrates three specialised reviewer sub-roles, collects their findings, deduplicates, and produces a final review with items marked as `MUST FIX` / `SHOULD FIX` / `SUGGESTION`.

**Input:** The feature branch diff + plan + dev notes.

**Output:** `.claude/workflow/<run-id>/review.md`

The Review Agent spawns (or simulates) three reviewer personas:

#### Reviewer A — Architect
Checks:
- Does the implementation follow the patterns in `KNOWLEDGE.md`?
- Are new modules consistent with existing ones (DB model → type → agent → API → page → sidebar)?
- No unnecessary abstractions or premature generalisation?
- Are dependencies between packages correct?

#### Reviewer B — Security
Checks:
- Is user data always scoped to `userId` in every DB query?
- No secrets or API keys committed?
- All external inputs validated with Zod?
- No SQL injection surface (Prisma parameterises, but raw queries need checking)?
- Clerk auth gate not accidentally bypassed?

#### Reviewer C — Performance & UX
Checks:
- No N+1 queries (eager-load with `include` where needed)?
- Paginated queries use `take` limits?
- Client components only where interactivity is needed (no "use client" on purely static pages)?
- AI endpoints return sensible errors instead of crashing?
- Loading / empty states handled in UI?

**Review output format:**
```markdown
## Review: SB-<n> — <title>
Branch: feature/SB-<n>-<slug>

### MUST FIX
- [ ] [Security] `apps/web/src/app/api/journals/route.ts:15` — missing userId scope on query
- [ ] [Arch] …

### SHOULD FIX
- [ ] [Perf] …

### SUGGESTIONS
- [ ] [UX] …

### Approved by
- [ ] Architect ✅
- [ ] Security  ⚠️ (1 must-fix)
- [ ] Perf/UX   ✅
```

**Prompt to spawn this agent:**
```
You are the Review Agent for the SecondBrain project.
Read KNOWLEDGE.md and AGENTIC_WORKFLOW.md in .claude/.
Checkout branch feature/SB-<n>-<slug> and review the full diff against master.
Apply three reviewer perspectives in sequence:
  1. Architect — architecture consistency
  2. Security  — data scoping, input validation, auth
  3. Performance/UX — query efficiency, loading states
Produce .claude/workflow/<run-id>/review.md using the format in AGENTIC_WORKFLOW.md.
Mark each finding as MUST FIX / SHOULD FIX / SUGGESTION.
After writing the review, fix every MUST FIX item yourself and commit to the branch.
Leave SHOULD FIX and SUGGESTION items in the review file for the human to decide.
```

---

### Agent 6 — PR Agent (`pr`)

**Role:** Creates the final PR on GitHub after all must-fix items are resolved.

**Input:** branch name, review.md, dev-notes.md, Jira ticket key.

**Output:** GitHub PR URL

**What it does:**
1. Verifies typecheck passes (`tsc --noEmit`)
2. Verifies no uncommitted changes remain
3. Pushes the feature branch to `origin`
4. Creates a PR with a structured description (summary, test plan, Jira link)
5. Prints the PR URL

**PR body template:**
```markdown
## Summary
<!-- 2-3 bullets from the PRD -->

## Changes
<!-- Key files changed and why -->

## Test plan
- [ ] Typecheck passes (`tsc --noEmit`)
- [ ] <specific manual test from acceptance criteria>
- [ ] <another>

## Jira
https://$JIRA_BASE_URL/browse/SB-<n>

## Review notes
<!-- Paste SHOULD FIX items from review.md for human reviewers -->

🤖 Generated with Claude Code agentic workflow
```

**Prompt to spawn this agent:**
```
You are the PR Agent for the SecondBrain project.
Branch: feature/SB-<n>-<slug>
Jira ticket: SB-<n>
Review file: .claude/workflow/<run-id>/review.md

1. Run: cd apps/web && npx tsc --noEmit — abort if it fails.
2. Check: git status — abort if uncommitted changes exist.
3. Push branch: git push -u origin feature/SB-<n>-<slug>
4. Create PR using `gh pr create` with the template from AGENTIC_WORKFLOW.md.
   Base branch: master. Include the Jira link and SHOULD FIX items in the body.
5. Print the PR URL.
```

---

## Orchestrator — Running the Full Pipeline

The orchestrator is the main Claude Code session. It spawns agents in sequence and shows you approval gates.

### Manual invocation (per agent)

Paste the relevant prompt block from above into a Claude Code session, substituting `<run-id>` and `<n>`.

### Semi-automated invocation via `/run-workflow`

You can invoke the whole pipeline from a single Claude Code message:

```
/run-workflow SB feature "Add dark-mode toggle to settings page"
```

This triggers the orchestrator to:
1. Spawn PM Agent → wait for Jira ticket key → **pause for your approval**
2. Spawn Planner Agent → wait for plan.md → **pause for your approval**
3. Spawn Dev Agent → wait for typecheck pass → **pause for your approval**
4. Spawn Test Agent → wait for test-report.md → **pause for your approval**
5. Spawn Review Agent → auto-fixes MUST FIX items → **pause for your approval**
6. Spawn PR Agent → open PR → prints URL

At each gate you can:
- **Approve** → continue to next agent
- **Edit** → modify the output file (plan.md, etc.) before continuing
- **Abort** → stop the pipeline

---

## Workflow File Structure

```
.claude/
└── workflow/
    └── 20260529-1430/          ← run-id = timestamp
        ├── prd.md              ← PM Agent output
        ├── jira-ticket.json    ← Jira API response
        ├── plan.md             ← Planner Agent output
        ├── dev-notes.md        ← Dev Agent output
        ├── test-report.md      ← Test Agent output
        └── review.md           ← Review Agent output (with MUST/SHOULD/SUGGEST)
```

---

## Quick Reference — Agent Spawn Commands

| Stage | Agent type | Key output |
|-------|-----------|------------|
| 1. Requirements | `pm` | `prd.md` + Jira ticket |
| 2. Planning | `planner` | `plan.md` |
| 3. Implementation | `dev` | feature branch commits |
| 4. Testing | `tester` | test files + `test-report.md` |
| 5. Code review | `reviewer` | `review.md` + MUST FIX commits |
| 6. Pull request | `pr` | GitHub PR URL |

---

## Environment Setup Checklist

```bash
# 1. Install gh CLI
sudo apt install gh && gh auth login

# 2. Add to .env.local
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=sanjay@example.com
JIRA_API_TOKEN=<atlassian token>
JIRA_PROJECT_KEY=SB

# 3. Verify
gh repo view                        # should show sanjay20/secondbrain
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.JIRA_BASE_URL)"
```

---

## Notes & Limitations

- **No Jira credentials yet** — tickets will fail until `JIRA_*` vars are added to `.env.local`. As a fallback, the PM Agent can write a local `prd.md` and skip the Jira API call; the Planner Agent can work from `prd.md` alone.
- **No `gh` CLI installed** — the PR Agent will fail at step 3. Install with `sudo apt install gh` and run `gh auth login` once.
- **No test framework configured** — the Test Agent will install Vitest on first run. Review and commit the config files it adds.
- **Production deploy** — the PR Agent does NOT trigger a production deploy. After merging, follow the deploy sequence in `KNOWLEDGE.md` (build → restart service).
- **Approval gates are manual** — Claude Code does not auto-proceed between agents. Each agent is spawned explicitly, giving you full control.
