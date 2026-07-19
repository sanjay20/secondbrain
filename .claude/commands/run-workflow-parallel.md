You are the orchestrator for the SecondBrain **parallel batch** development pipeline.

Arguments passed: $ARGUMENTS

> **Single source of truth:** agent **models** and full **prompt blocks** live in
> `.claude/AGENTIC_WORKFLOW.md` — the Model Strategy table, the per-agent definitions
> (Agents 1–6), and the **Parallel Batch Mode** section (Agent 0 — Overlap Analyzer, the
> Lane Runner, the lane model, and `lanes.json` schema). This command references them; it does
> NOT restate prompts. When spawning any agent, look up its model and prompt there and
> substitute `<batch-id>`, `<ticket>`, and `<n>` (the SB number).

This command handles **2+ tickets at once**. For a single ticket, use `/run-workflow <key>` instead.

## Step 0 — Board discovery (list mode)

**Trigger this step when** `$ARGUMENTS` is **empty**, or its first token is `list` / `board` /
`ls` / `--list`. (When `$ARGUMENTS` already contains 2+ `SB-<n>` keys, skip straight to Step 1 —
the user has already chosen.)

In list mode, read the whole Jira board and let the user choose:

1. Run the board fetcher (reads `JIRA_*` from `apps/web/.env.local`, no secrets printed):
   ```
   node .claude/scripts/jira-board.mjs --json .claude/workflow/_board/issues.json
   ```
   Pass any `--status="<name>"` tokens from `$ARGUMENTS` through to the script (default status is
   `To Do`; repeatable). Use `--all-desc` if the user asks for descriptions of every story.
2. Print the script's grouped output verbatim: **Epics**, the **runnable stories with descriptions**
   (grouped by epic), and the compact **Other stories** index. The raw rows are cached at
   `.claude/workflow/_board/issues.json` for reference.
3. **PAUSE.** Ask the user to reply with the list of keys to run this batch (2+, e.g.
   `SB-13 SB-14 SB-18`). Note that **Epics are containers, not runnable** — only Story-type keys
   should be picked. The user MAY also attach **details/context** with their selection — either
   batch-wide free-text, or per-ticket notes in the form `SB-13: also link skills to career goals`.
   Capture these; they are passed to each ticket's PM Agent in Step 2 as the "Feature description"
   hint so the PM interview starts from the user's intent rather than the bare ticket. When the user
   replies, continue at **Step 1** using the keys + captured notes.

> **This is the default entry point.** Running `/run-workflow-parallel` with no keys always lists
> the board's To-Do stories first and waits for the user's pick — it never guesses a batch.

> The batch scheduler decides parallel-vs-sequential automatically (Steps 5–7): non-overlapping
> tickets get their own lanes and run **in parallel**; tickets that touch the same files are
> **serialized + stacked** in one lane. The user picks *what* to build; overlap analysis picks *how*.

## Step 1 — Parse the ticket list

Parse `$ARGUMENTS` into a list of Jira keys (space- or comma-separated, e.g. `SB-30 SB-31 SB-32`).

- Fewer than 2 keys → tell the user to use `/run-workflow <key>` and stop.
- A `--dry-run` token anywhere in the arguments → set **dry-run mode** (see below); strip it from
  the key list.
- Trailing free-text is **kept as context**, not ignored. Batch-wide notes apply to every ticket;
  per-ticket notes (`SB-13: <note>`) apply to that one. Store them keyed by ticket and pass each to
  its PM Agent in Step 2 as the "Feature description" hint. Batch mode still operates only on
  **existing** tickets — the notes refine requirements, they don't create tickets.

**Dry-run mode** (`/run-workflow-parallel SB-30 SB-31 SB-32 --dry-run`): run only the read-only
phases — PM (Step 2), Planner (Step 4), and the Overlap Analyzer (Step 5) — then print `overlap.md`
+ the lane plan and **STOP**. Skip both approval gates and all of Phase 2: **no worktrees, no
branches, no commits, no PRs**. Use it to validate the overlap/lane decision cheaply before a real
batch. (It still spends the PM/Planner/Analyzer model calls, but has zero git side effects.) The PM
interview still surfaces requirement gaps; for a dry-run you may let PMs assume-and-record gaps in
the PRD rather than blocking.

Generate `batch_id` = current date-time `YYYYMMDD-HHMM`. Create `.claude/workflow/<batch-id>/` and
one subdir per ticket (`.claude/workflow/<batch-id>/<ticket>/`). Write `batch.json` with the ticket
list and `phase: "pm"`.

## Step 2 — Phase 0a: fan-out PM (parallel, read-only)

For **every** ticket, spawn the **PM Agent** (AGENTIC_WORKFLOW.md, Agent 1) — all in parallel, each
writing to its own `.claude/workflow/<batch-id>/<ticket>/`. PM is read-only (no branches/commits),
so the shared tree is safe for concurrent runs.

**Pass the user's notes through.** If the user attached details for a ticket in Step 0/1 (batch-wide
or `SB-<n>: <note>`), inject them into that ticket's PM Agent prompt as the optional "Feature
description" hint. The PM Agent merges the ticket's own fields with this hint, so it interviews only
for what's still missing and bakes the user's intent into the PRD.

Handle returns:
- `needs_human` — collect the open questions from **all** PMs, ask the user **once**, grouped by
  ticket (use AskUserQuestion). Then resume each PM (SendMessage to its agentId) with its answers.
  Re-read each ticket's `handoff.json`.
- `failed` — report it; ask the user whether to **drop that ticket** and continue, or **abort**.

## Step 3 — ⛔ Batched PRD gate

Show a one-paragraph summary of every ticket's `prd.md`. **PAUSE.** Ask the user:
**Approve all / Edit `<ticket>` / Drop `<ticket>` / Abort batch.** Only approved tickets proceed.

## Step 4 — Phase 0b: fan-out Planner (parallel, read-only)

For every remaining ticket, spawn the **Planner Agent** (Agent 2) in parallel, writing `plan.md`
(with its `Affected files` table) to the ticket subdir. Read-only. Handle `failed`/`needs_human`
as in Step 2.

## Step 5 — Phase 1: Overlap Analyzer

Spawn **Agent 0 — Overlap Analyzer** (single call, `opus`). It reads every ticket's `plan.md`,
classifies pairwise conflicts (HARD / SOFT / NONE), and writes `overlap.md` + `lanes.json`.
Read `lanes.json`.

> **Dry-run stops here.** If dry-run mode was set in Step 1, print `overlap.md` and the lane plan
> (parallel vs chained + merge order), then STOP. Do not run Steps 6–8.

## Step 6 — ⛔ Batched Plan gate (+ lane plan)

Show: each ticket's plan summary **plus the lane plan** from `overlap.md` — which tickets run in
parallel, which are chained, and the merge order. This is the checkpoint **before** you spend
Phase-2 compute (parallel Opus lanes multiply cost by lane count). **PAUSE.** Ask:
**Approve / Edit a plan / Re-run overlap / Abort.**
- Approve → Step 7.
- Edit → let the user modify a `plan.md`, then **re-run the Overlap Analyzer** (Step 5) and re-show.
- Abort → stop.

## Step 7 — Phase 2: run lanes in parallel

For each lane in `lanes.json`, spawn a **Lane Runner** (AGENTIC_WORKFLOW.md → Lane Runner):
`subagent_type: general-purpose`, `model: opus`, **`isolation: "worktree"`**,
**`run_in_background: true`**. Pass the lane's tickets (in merge order) and their `plan.md` paths.
Each Lane Runner runs Dev→Test→Review→PR (Agents 3–6) per ticket, stacking branches for chained
tickets (first off `master`, each next off the previous ticket's branch).

Spawn **all** lanes, then wait — you are notified as each finishes.

Per-lane stop conditions (they do NOT abort the batch):
- A lane returns a `failed`/`needs_human` ticket → pause **that lane only**; relay the question to
  the user; resume that lane with the answer. Sibling lanes keep running.

## Step 8 — Consolidate

Once all lanes report, write `.claude/workflow/<batch-id>/batch-report.md` and print a table:

| Ticket | Lane | Branch | PR | Base | Status |

For chained lanes, state the **merge order** explicitly (merge each base PR before its stacked
child). List any failed lanes and the ticket/stage where they stopped.

---

Do not pause for approval anywhere except the **batched PRD gate** (Step 3) and the **batched Plan
gate** (Step 6). All of Phase 2 runs unattended except for a per-lane `needs_human`.

### Operational notes
- **Isolation depends on worktree support** in the harness (`isolation: "worktree"`). Without it,
  lanes cannot run safely in parallel — fall back to running lanes sequentially.
- **`gh` and Jira** prerequisites are the same as `/run-workflow` (see AGENTIC_WORKFLOW.md →
  Prerequisites). PMs need Jira creds; PR steps need `gh` authenticated.
- **Cost:** N parallel lanes ≈ N× the Opus usage of a single run — confirm the batch size at the
  plan gate before proceeding.
