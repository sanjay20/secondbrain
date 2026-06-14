You are the orchestrator for the SecondBrain agentic development pipeline.

Arguments passed: $ARGUMENTS

> **Single source of truth:** agent **models** and the full **prompt blocks** for every
> agent live in `.claude/AGENTIC_WORKFLOW.md` (Model Strategy table + per-agent definitions).
> This command does NOT restate them — it references them, so there is exactly one place to
> edit a model or a prompt. When spawning any agent, look up its model and prompt there and
> substitute `<run-id>`, `<jira_ticket>`, `<feature_description>`, and `<n>` (the SB ticket
> number) as needed.

## Step 1 — Parse arguments

Parse `$ARGUMENTS` to determine the mode:

- If the first word matches a Jira key pattern (e.g. `SB-22`, `SB-123`):
  - `jira_ticket` = that key (e.g. `SB-22`)
  - `feature_description` = remaining words (may be empty)
- If the first word is a Jira project prefix followed by `feature` or `bug` or `task` (e.g. `SB feature "..."`):
  - `jira_ticket` = "none"
  - `feature_description` = the quoted string that follows
- Otherwise treat the entire argument as a free-text feature description:
  - `jira_ticket` = "none"
  - `feature_description` = full argument string

Generate `run_id` = current date-time in format `YYYYMMDD-HHMM` (e.g. `20260530-1430`).

Create the run directory: `.claude/workflow/<run-id>/`

## Step 2 — Spawn PM Agent

Spawn the PM Agent using its **model and prompt block from `.claude/AGENTIC_WORKFLOW.md`
(Agent 1 — PM Agent)**, substituting `<jira_ticket>`, `<feature_description>`, and `<run-id>`.

The PM Agent fetches the Jira ticket (if provided), runs the requirement-gap interview, writes
`prd.md`, and writes `handoff.json`. It cannot prompt you directly — when it has open questions
it returns `status: "needs_human"` and the orchestrator relays them (see Step 3).

## Step 3 — PM interview + PRD GATE (approval gate)

The human is involved at two approval gates in this pipeline: the PRD gate (here, after the PM
Agent) and the plan gate (Step 4). Dev / Test / Review / PR all auto-proceed.

After the PM Agent returns:
1. Read `handoff.json`.
2. If `status == "needs_human"`:
   - The PM Agent has open requirement questions. Relay them to the user (use AskUserQuestion
     for the gap questions; keep it to the questions the agent listed).
   - Resume the SAME PM Agent with the user's answers (SendMessage to its agentId) so it can
     finalize the PRD. Re-read `handoff.json` after it finishes.
   - Repeat only if it emits `needs_human` again (it shouldn't — it's instructed to ask once).
3. If `status == "failed"` → stop and report the error.
4. Once `status == "done"`: show the user the PRD summary and the path
   `.claude/workflow/<run-id>/prd.md` plus the Jira key, then:
   **⛔ PRD GATE — PAUSE and ask the user: Approve / Edit / Abort.**
   - Approve → continue to Step 4 (Planner Agent).
   - Edit → let the user modify `prd.md` (or answer follow-ups), then re-confirm and continue.
   - Abort → stop the pipeline.

## Step 4 — Spawn Planner Agent → PLAN GATE (approval gate)

1. Read `handoff.json` for `ticket` and `run_id`.
2. Spawn the Planner Agent using its model and prompt block from `.claude/AGENTIC_WORKFLOW.md`
   (Agent 2 — Planner Agent), substituting `<run-id>` and `<n>`.
3. When it returns `status: "done"`, show the user the plan summary and the path
   `.claude/workflow/<run-id>/plan.md`.
4. **⛔ PLAN GATE — PAUSE and ask the user: Approve / Edit / Abort.**
   - Approve → continue to Step 5.
   - Edit → let the user modify `plan.md`, then re-confirm and continue.
   - Abort → stop the pipeline.

## Step 5 — Auto-run Dev → Test → Review → PR (no approval pauses)

After the plan is approved, run the remaining agents back-to-back WITHOUT pausing for
approval between them. For each: read `handoff.json` for `branch`/`ticket`, spawn the agent
using its model and prompt block from `.claude/AGENTIC_WORKFLOW.md`, and on `status: "done"`
show a one-line summary and immediately spawn the next.

1. **Dev Agent** (Agent 3). Branch off `master`.
2. **Test Agent** (Agent 4).
3. **Review Agent** (Agent 5). Auto-fixes MUST FIX items.
4. **PR Agent** (Agent 6). Pushes the branch to `origin` and opens the GitHub PR automatically
   (requires `gh` to be authenticated). Print the PR URL.

Stop conditions that override auto-proceed at ANY stage:
- `status == "failed"` → stop immediately and report the error (do not advance).
- `status == "needs_human"` → pause, relay the agent's question to the user, then resume that
  same agent with the answer before continuing.

Do not ask the user for approval at any stage other than the PRD gate (Step 3) and the plan gate (Step 4).
