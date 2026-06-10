# SecondBrain — Agentic Development Workflow

A multi-agent pipeline that takes a feature idea from raw conversation all the way to a merged GitHub PR. The human is involved at **two points only**:

1. **PM Agent interview (interactive)** — the PM Agent asks you the requirement-gap questions and waits for your answers before finalizing the PRD.
2. **Plan gate (approval)** — you approve (or edit/abort) the plan after the Planner Agent.

Every other stage (Dev, Test, Review, PR) auto-proceeds without pausing.

> **Mechanic:** subagents spawned via the Agent tool cannot talk to you directly. So the PM "interview" is mediated by the orchestrator: the PM Agent returns its open questions with `status: "needs_human"`, the orchestrator asks you, then resumes the same PM Agent with your answers so it can finalize the PRD.

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

## Model Strategy

Each agent is assigned the cheapest model that can reliably handle its task. Expensive models (Opus) are reserved for steps that require deep reasoning; fast/cheap models (Haiku) handle mechanical execution.

| Agent | Model | Reason |
|-------|-------|--------|
| PM Agent | `claude-sonnet-4-6` | Structured interview + PRD writing — balanced capability |
| Planner Agent | `claude-opus-4-8` | Codebase-wide reasoning, architectural thinking — highest quality needed |
| Dev Agent | `claude-sonnet-4-6` | TypeScript implementation — Sonnet handles code very well at lower cost |
| Test Agent | `claude-sonnet-4-6` | Test writing follows clear patterns — Sonnet is sufficient |
| Review Agent | `claude-opus-4-8` | Multi-angle security/architecture analysis — deep reasoning required |
| PR Agent | `claude-haiku-4-5-20251001` | Pure CLI execution (tsc, git push, gh pr create) — minimal reasoning |

---

## Handoff Protocol

Every agent **must** write `.claude/workflow/<run-id>/handoff.json` as its final action. The orchestrator reads this to decide whether to proceed and which agent to spawn next.

```json
{
  "agent": "pm",
  "status": "done",
  "run_id": "20260529-1430",
  "ticket": "SB-42",
  "branch": null,
  "next_agent": "planner",
  "summary": "PRD written. Jira ticket SB-42 created."
}
```

| Field | Values | Notes |
|-------|--------|-------|
| `agent` | `pm` \| `planner` \| `dev` \| `tester` \| `reviewer` \| `pr` | Who wrote this |
| `status` | `done` \| `failed` \| `needs_human` | `needs_human` = blocked, requires input |
| `next_agent` | next agent name or `null` | `null` only for the PR Agent |
| `branch` | branch name or `null` | Set by Dev Agent, carried forward by Tester/Reviewer/PR |
| `summary` | one-sentence result | Shown to the human at the approval gate |

The orchestrator will **not** proceed if `status` is anything other than `done`.

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

**Model:** `claude-sonnet-4-6`
**Role:** Product Manager. Optionally reads an existing Jira ticket, conducts a gap-filling interview only for missing information, writes a PRD, and creates or updates a Jira issue.

> **Interactive:** the PM Agent is the one stage that actively interviews the human. Because a subagent cannot prompt the user directly, it surfaces its open questions by writing `handoff.json` with `status: "needs_human"` and listing the questions in its final message. The orchestrator asks you and resumes the same agent with your answers; the PM Agent then finalizes the PRD and writes a `status: "done"` handoff. If the ticket already answers all 7 questions, it skips straight to `done` with no interview.

**Input:**
- Free-text description of the feature/bug from the user (optional if Jira ticket is provided).
- Optional: existing Jira ticket key (e.g. `SB-42`). When provided, the agent fetches the ticket first and skips interview questions already answered there.

**Output:**
- `.claude/workflow/<run-id>/prd.md` — full PRD
- `.claude/workflow/<run-id>/jira-ticket.json` — Jira issue payload (existing or newly created)
- Jira ticket URL printed to stdout

**Decision logic:**

```
IF jira_ticket_key is provided:
  1. Fetch ticket from Jira API (GET /rest/api/3/issue/<key>)
  2. Extract: summary, description, acceptance criteria, priority, labels, story points
  3. Map each of the 7 interview questions against what the ticket already answers
  4. If any questions are unanswered/vague → emit status "needs_human" with those questions,
     wait to be resumed with the answers (may be 0 questions → skip straight to PRD)
  5. Merge ticket content + interview answers → write PRD
  6. Save existing ticket JSON to jira-ticket.json (no new ticket created)
ELSE:
  1. Emit status "needs_human" with all 7 interview questions; wait to be resumed with answers
  2. Write PRD from answers
  3. Create a new Jira issue via POST /rest/api/3/issue
  4. Save new ticket JSON to jira-ticket.json
```

**Interview questions (asked only when the ticket doesn't already answer them):**
1. What problem does this solve for the user?
2. Who is the primary user / persona?
3. What is the expected behaviour? (happy path)
4. What are the edge cases or constraints?
5. Is this a small task (≤ 1 day) or a feature (> 1 day)?
6. Priority: critical / high / medium / low?
7. Any dependencies on other tickets or external services?

**Jira API calls it makes:**
```
# Fetch existing ticket (when ticket key supplied)
GET https://$JIRA_BASE_URL/rest/api/3/issue/<key>
Authorization: Basic base64($JIRA_EMAIL:$JIRA_API_TOKEN)

# Create new ticket (when no ticket key supplied)
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
Model: claude-sonnet-4-6

Jira ticket (optional): <SB-n or "none">
Feature description (optional): "<paste user description here>"
Run ID: <timestamp e.g. 20260529-1430>

Your job:

STEP 1 — Gather context
  IF a Jira ticket key was provided (not "none"):
    a. Load credentials from .env.local (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN).
    b. Fetch the ticket:
         GET $JIRA_BASE_URL/rest/api/3/issue/<key>
         Authorization: Basic base64($JIRA_EMAIL:$JIRA_API_TOKEN)
    c. Save the raw response to .claude/workflow/<run-id>/jira-ticket.json.
    d. Review the ticket content against the 7 interview questions:
         1. What problem does this solve for the user?
         2. Who is the primary user / persona?
         3. What is the expected behaviour? (happy path)
         4. What are the edge cases or constraints?
         5. Is this a small task (≤ 1 day) or a feature (> 1 day)?
         6. Priority: critical / high / medium / low?
         7. Any dependencies on other tickets or external services?
    e. For each question already clearly answered in the ticket, mark it as resolved.
    f. INTERACTIVE INTERVIEW: if any questions remain unanswered or vague, do NOT guess.
       Write handoff.json with status "needs_human" listing those questions, and put the
       questions clearly in your final message. STOP — the orchestrator will ask the human
       and resume you with the answers. (You cannot prompt the user directly; you are a subagent.)
       If all 7 questions are already answered by the ticket, skip the interview and go to STEP 2.
  ELSE:
    a. INTERACTIVE INTERVIEW: write handoff.json with status "needs_human" listing all 7
       questions, put them in your final message, and STOP. The orchestrator asks the human
       and resumes you with the answers.
    b. After being resumed with answers, create a new Jira issue:
         POST $JIRA_BASE_URL/rest/api/3/issue
         Issue type: "Story" for features, "Bug" for bugs, "Task" for small tasks.
    c. Save the created issue JSON to .claude/workflow/<run-id>/jira-ticket.json.

  NOTE ON RESUMING: when the orchestrator resumes you with the human's answers, continue
  from STEP 2 using those answers. Only emit "needs_human" once; if you still have gaps after
  the answers, make reasonable assumptions and record them in the PRD's "Open Questions".

STEP 2 — Write PRD
  Merge ticket content (if any) and interview answers.
  Write a PRD following the template in AGENTIC_WORKFLOW.md.
  Save to .claude/workflow/<run-id>/prd.md.

STEP 3 — Handoff
  Write .claude/workflow/<run-id>/handoff.json (final, after the PRD is written):
  { "agent": "pm", "status": "done", "run_id": "<run-id>", "ticket": "<SB-n>",
    "branch": null, "next_agent": "planner",
    "summary": "PRD written. Jira ticket <SB-n> used/created." }
  Print the Jira ticket URL and key (e.g. SB-42) when done.
```

---

### Agent 2 — Planner Agent (`planner`)

**Model:** `claude-opus-4-8`
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
Model: claude-opus-4-8
Read KNOWLEDGE.md and AGENTIC_WORKFLOW.md in .claude/ to understand the architecture.
Read the PRD at .claude/workflow/<run-id>/prd.md.
Read .claude/workflow/<run-id>/handoff.json to get the ticket key.
Fetch the Jira ticket SB-<n> from Jira (credentials in .env.local) for context.
Explore the codebase to identify exactly which files need to change.
Write a detailed implementation plan to .claude/workflow/<run-id>/plan.md.
Do NOT write any code yet.
Finally, write .claude/workflow/<run-id>/handoff.json:
  { "agent": "planner", "status": "done", "run_id": "<run-id>", "ticket": "<SB-n>",
    "branch": null, "next_agent": "dev",
    "summary": "Plan written. <N> implementation steps across <M> files." }
```

---

### Agent 3 — Dev Agent (`dev`)

**Model:** `claude-sonnet-4-6`
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
Model: claude-sonnet-4-6
Read KNOWLEDGE.md and AGENTIC_WORKFLOW.md in .claude/ to understand the codebase.
Read .claude/workflow/<run-id>/handoff.json to confirm the ticket key.
Read the implementation plan at .claude/workflow/<run-id>/plan.md.
Create a feature branch: git checkout -b feature/SB-<n>-<slug>
Implement every step in the plan. After all changes:
  - Run: cd apps/web && npx tsc --noEmit  (must pass)
  - If schema changed: cd packages/db && npx prisma db push && npx prisma generate
  - Commit all changes with clear commit messages
Write a brief dev-notes.md to .claude/workflow/<run-id>/dev-notes.md summarising
any decisions you made that differ from the plan.
Do NOT push to remote yet.
Finally, write .claude/workflow/<run-id>/handoff.json:
  { "agent": "dev", "status": "done", "run_id": "<run-id>", "ticket": "<SB-n>",
    "branch": "feature/SB-<n>-<slug>", "next_agent": "tester",
    "summary": "Implementation complete. Typecheck passes. <N> commits on branch." }
```

---

### Agent 4 — Test Agent (`tester`)

**Model:** `claude-sonnet-4-6`
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
Model: claude-sonnet-4-6
Read KNOWLEDGE.md and AGENTIC_WORKFLOW.md in .claude/.
Read .claude/workflow/<run-id>/handoff.json to get the branch name.
Checkout branch feature/SB-<n>-<slug> and run: git diff main --name-only
For every changed file that contains public functions or API routes, write tests.
Use the project's existing test setup. If no test framework is configured yet,
install vitest + @testing-library/react and configure it minimally in apps/web.
Commit test files to the same branch.
Write .claude/workflow/<run-id>/test-report.md listing: what was tested, coverage
estimate, and anything deliberately excluded (with reason).
Finally, write .claude/workflow/<run-id>/handoff.json:
  { "agent": "tester", "status": "done", "run_id": "<run-id>", "ticket": "<SB-n>",
    "branch": "feature/SB-<n>-<slug>", "next_agent": "reviewer",
    "summary": "Tests written. <N> test files, ~<M>% coverage of changed code." }
```

---

### Agent 5 — Review Agent (`reviewer`)

**Model:** `claude-opus-4-8`
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
Model: claude-opus-4-8
Read KNOWLEDGE.md and AGENTIC_WORKFLOW.md in .claude/.
Read .claude/workflow/<run-id>/handoff.json to get the branch name.
Checkout branch feature/SB-<n>-<slug> and review the full diff against master.
Apply three reviewer perspectives in sequence:
  1. Architect — architecture consistency
  2. Security  — data scoping, input validation, auth
  3. Performance/UX — query efficiency, loading states
Produce .claude/workflow/<run-id>/review.md using the format in AGENTIC_WORKFLOW.md.
Mark each finding as MUST FIX / SHOULD FIX / SUGGESTION.
After writing the review, fix every MUST FIX item yourself and commit to the branch.
Leave SHOULD FIX and SUGGESTION items in the review file for the human to decide.
Finally, write .claude/workflow/<run-id>/handoff.json:
  { "agent": "reviewer", "status": "done", "run_id": "<run-id>", "ticket": "<SB-n>",
    "branch": "feature/SB-<n>-<slug>", "next_agent": "pr",
    "summary": "<N> MUST FIX resolved. <M> SHOULD FIX left for human review." }
```

---

### Agent 6 — PR Agent (`pr`)

**Model:** `claude-haiku-4-5-20251001`
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
Model: claude-haiku-4-5-20251001
Read .claude/workflow/<run-id>/handoff.json to get branch name and ticket key.
Review file: .claude/workflow/<run-id>/review.md

1. Run: cd apps/web && npx tsc --noEmit — abort and set status "failed" if it fails.
2. Check: git status — abort if uncommitted changes exist.
3. Push branch: git push -u origin feature/SB-<n>-<slug>
4. Create PR using `gh pr create` with the template from AGENTIC_WORKFLOW.md.
   Base branch: master. Include the Jira link and SHOULD FIX items in the body.
5. Write .claude/workflow/<run-id>/handoff.json:
   { "agent": "pr", "status": "done", "run_id": "<run-id>", "ticket": "<SB-n>",
     "branch": "feature/SB-<n>-<slug>", "next_agent": null,
     "summary": "PR opened: <PR URL>" }
6. Print the PR URL.
```

---

## Orchestrator — Running the Full Pipeline

The orchestrator is the main Claude Code session. It spawns agents in sequence using the model specified in each agent's definition and reads `handoff.json` after each agent completes. The human is involved at two points:

- **PM interview** — when the PM Agent returns `status: "needs_human"` (it has open questions), the orchestrator relays those questions to you, then resumes the same PM Agent with your answers.
- **Plan gate** — after the Planner Agent completes (before the Dev Agent runs), the orchestrator pauses for your Approve / Edit / Abort.

Every other stage auto-proceeds: once an agent finishes with `status: "done"`, the orchestrator immediately spawns the next agent without waiting for you. (A `status` of `failed` always stops the pipeline; `needs_human` pauses for input at any stage — see step 5.)

### Orchestrator loop (pseudo-code)

```
run_id = timestamp()
next_agent = "pm"
jira_ticket = <provided by user, or null>   # e.g. "SB-42" or null

while next_agent is not null:
  1. Read .claude/workflow/<run-id>/handoff.json (if exists)
  2. Build agent prompt, substituting run_id and jira_ticket where applicable:
       - PM Agent: pass jira_ticket (or "none") in the prompt header
       - All other agents: pass ticket key from handoff.json
  3. Spawn Agent(model=<agent.model>, prompt=<agent.prompt>)
  4. Agent completes → writes handoff.json
  5. Read handoff.json:
       if status == "failed"  → stop, report error
       if status == "needs_human" →
            # PM interview (and any agent that needs input) is handled here:
            ask the user the agent's open questions,
            then RESUME the same agent (SendMessage to its agentId) with the answers.
            Re-read handoff.json after it finishes. Do NOT advance next_agent yet.
       if status == "done"    → show summary to user
  6. PLAN GATE (the only approval gate):
       if handoff.json["agent"] == "planner":
            PAUSE — ask user: Approve / Edit / Abort
       else:
            auto-proceed (no pause)   # PM, dev, tester, reviewer, pr
  7. next_agent = handoff.json["next_agent"]
```

### Manual invocation (per agent)

Paste the relevant prompt block from above into a Claude Code session, substituting `<run-id>` and `<n>`. The model is specified in the prompt; set it via the `model:` parameter of the Agent tool.

### Semi-automated invocation via `/run-workflow`

You can invoke the whole pipeline from a single Claude Code message.

**Starting from a description (PM agent creates a new Jira ticket):**
```
/run-workflow SB feature "Add dark-mode toggle to settings page"
```

**Starting from an existing Jira ticket (PM agent reads it, interviews only for gaps):**
```
/run-workflow SB-42
```

**Starting from a Jira ticket with an additional description hint:**
```
/run-workflow SB-42 "also handle mobile viewport edge case"
```

This triggers the orchestrator to:
1. Spawn PM Agent (`sonnet`) — reads Jira ticket if provided → **💬 INTERACTIVE: asks you the requirement-gap questions and waits for answers** → writes PRD + handoff.json → _auto-proceed_
2. Spawn Planner Agent (`opus`) → writes handoff.json → **⛔ PLAN GATE — pause for your approval**
3. Spawn Dev Agent (`sonnet`) → writes handoff.json → _auto-proceed_
4. Spawn Test Agent (`sonnet`) → writes handoff.json → _auto-proceed_
5. Spawn Review Agent (`opus`) → auto-fixes MUST FIX, writes handoff.json → _auto-proceed_
6. Spawn PR Agent (`haiku`) → pushes branch + opens PR, writes handoff.json (next=null) → prints URL

Besides the PM interview in step 1, the **only** approval stop is the plan gate after step 2. At that gate you can:
- **Approve** → orchestrator reads `next_agent` from handoff.json and spawns the Dev Agent
- **Edit** → modify `plan.md` before approving
- **Abort** → stop the pipeline

> **Note:** With auto-proceed enabled, the PR Agent (step 6) pushes the feature branch to `origin` and opens a GitHub PR **without a confirmation pause**. This requires `gh` to be authenticated beforehand. A `failed` or `needs_human` handoff at any stage still halts the pipeline automatically.

---

## Workflow File Structure

```
.claude/
└── workflow/
    └── 20260529-1430/          ← run-id = timestamp
        ├── handoff.json        ← written by each agent; orchestrator reads to chain
        ├── prd.md              ← PM Agent output
        ├── jira-ticket.json    ← Jira API response
        ├── plan.md             ← Planner Agent output
        ├── dev-notes.md        ← Dev Agent output
        ├── test-report.md      ← Test Agent output
        └── review.md           ← Review Agent output (with MUST/SHOULD/SUGGEST)
```

---

## Quick Reference — Agent Spawn Commands

| Stage | Agent | Model | Key output |
|-------|-------|-------|------------|
| 1. Requirements | `pm` | `claude-sonnet-4-6` | `prd.md` + Jira ticket |
| 2. Planning | `planner` | `claude-opus-4-8` | `plan.md` |
| 3. Implementation | `dev` | `claude-sonnet-4-6` | feature branch commits |
| 4. Testing | `tester` | `claude-sonnet-4-6` | test files + `test-report.md` |
| 5. Code review | `reviewer` | `claude-opus-4-8` | `review.md` + MUST FIX commits |
| 6. Pull request | `pr` | `claude-haiku-4-5-20251001` | GitHub PR URL |

Every agent also writes `handoff.json` — the orchestrator reads it to chain to the next agent.

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
- **Two human touchpoints** — (1) the PM Agent interview (interactive: it asks you gap questions via the orchestrator and waits), and (2) the plan gate approval after the Planner Agent. Dev, Test, Review, and PR auto-proceed: the orchestrator spawns the next agent as soon as the previous one returns `status: "done"`. A `failed` handoff halts the run; `needs_human` pauses for input. To add back more gates, change step 6 of the orchestrator loop (e.g. also pause when `agent == "reviewer"`).
