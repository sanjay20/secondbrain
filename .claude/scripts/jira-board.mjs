#!/usr/bin/env node
// Board discovery for the SecondBrain agentic workflow.
// Fetches every issue in the Jira project and prints a grouped, human-readable
// view (Epics, runnable To-Do stories WITH descriptions grouped by epic, and a
// compact Done index). Also caches the raw rows as JSON for the orchestrator.
//
// Usage:
//   node .claude/scripts/jira-board.mjs [--status=<name>] [--json <path>] [--all-desc]
//     --status=<name>  Only show full descriptions for stories in this status (default: "To Do").
//                      Repeatable, e.g. --status="To Do" --status="In Progress".
//     --json <path>    Where to cache the raw rows (default: .claude/workflow/_board/issues.json).
//     --all-desc       Print descriptions for every story regardless of status.
//
// Credentials come from apps/web/.env.local (falls back to ./.env.local):
//   JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY
import fs from "node:fs";
import path from "node:path";

// ---- args ----
const argv = process.argv.slice(2);
const statuses = [];
let jsonPath = ".claude/workflow/_board/issues.json";
let allDesc = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--status=")) statuses.push(a.slice("--status=".length));
  else if (a === "--json") jsonPath = argv[++i];
  else if (a === "--all-desc") allDesc = true;
}
if (statuses.length === 0) statuses.push("To Do");
const descStatuses = new Set(statuses.map((s) => s.toLowerCase()));

// ---- creds ----
const envFile = [
  "apps/web/.env.local",
  ".env.local",
].find((p) => fs.existsSync(p));
if (!envFile) {
  console.error("No .env.local found (looked in apps/web/.env.local, ./.env.local). Add JIRA_* vars first.");
  process.exit(2);
}
const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
for (const k of ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"]) {
  if (!env[k]) { console.error(`Missing ${k} in ${envFile}`); process.exit(2); }
}
const BASE = env.JIRA_BASE_URL.replace(/\/$/, "");
const AUTH = "Basic " + Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString("base64");
const PROJECT = env.JIRA_PROJECT_KEY || "SB";

// ---- ADF -> plain text ----
function adfToText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  let out = "";
  if (node.type === "text") out += node.text || "";
  if (node.type === "hardBreak") out += "\n";
  if (node.content) {
    for (const c of node.content) out += adfToText(c);
    if (["paragraph", "heading", "listItem", "blockquote"].includes(node.type)) out += "\n";
  }
  if (node.type === "listItem") out = "  • " + out;
  return out;
}

async function jira(p, opts = {}) {
  const res = await fetch(`${BASE}${p}`, {
    ...opts,
    headers: { Authorization: AUTH, Accept: "application/json", "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${p}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const FIELDS = ["summary", "status", "priority", "issuetype", "parent", "description", "labels", "assignee", "created", "updated"];
const jql = `project = ${PROJECT} ORDER BY key ASC`;

async function fetchAll() {
  const issues = [];
  try {
    let nextPageToken;
    do {
      const body = { jql, maxResults: 100, fields: FIELDS, ...(nextPageToken ? { nextPageToken } : {}) };
      const page = await jira(`/rest/api/3/search/jql`, { method: "POST", body: JSON.stringify(body) });
      issues.push(...(page.issues || []));
      nextPageToken = page.nextPageToken;
    } while (nextPageToken);
    return issues;
  } catch {
    let startAt = 0, total = Infinity;
    while (startAt < total) {
      const page = await jira(`/rest/api/3/search`, { method: "POST", body: JSON.stringify({ jql, startAt, maxResults: 100, fields: FIELDS }) });
      issues.push(...(page.issues || []));
      total = page.total ?? issues.length;
      startAt += page.maxResults || 100;
      if (!page.issues || page.issues.length === 0) break;
    }
    return issues;
  }
}

const num = (k) => parseInt(k.split("-")[1], 10);
const clip = (s, n = 600) => (s.length > n ? s.slice(0, n).trimEnd() + " …[truncated]" : s);

const issues = await fetchAll();
const rows = issues.map((it) => {
  const f = it.fields || {};
  return {
    key: it.key,
    type: f.issuetype?.name || "",
    status: f.status?.name || "",
    priority: f.priority?.name || "",
    epic: f.parent?.fields?.summary ? `${f.parent.key} · ${f.parent.fields.summary}` : (f.parent?.key || ""),
    labels: f.labels || [],
    assignee: f.assignee?.displayName || "Unassigned",
    summary: f.summary || "",
    description: f.description ? adfToText(f.description).replace(/\n{3,}/g, "\n\n").trim() : "",
  };
}).sort((a, b) => num(a.key) - num(b.key));

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));

// ---- render ----
const epics = rows.filter((r) => r.type === "Epic");
const stories = rows.filter((r) => r.type !== "Epic");
const runnable = stories.filter((r) => allDesc || descStatuses.has(r.status.toLowerCase()));
const rest = stories.filter((r) => !runnable.includes(r));

let out = `# ${PROJECT} board — ${rows.length} issues (${epics.length} epics, ${stories.length} stories)\n`;
out += `_source: ${BASE} · cached: ${jsonPath}_\n\n`;

out += `## Epics (${epics.length})\n\n`;
for (const e of epics) out += `- **${e.key}** — ${e.summary} _(${e.status})_\n`;

out += `\n## ▶ Runnable stories — status: ${statuses.join(", ")} (${runnable.length})\n`;
const byEpic = {};
for (const s of runnable) (byEpic[s.epic || "— no epic —"] ||= []).push(s);
for (const epic of Object.keys(byEpic)) {
  out += `\n### Epic: ${epic}\n`;
  for (const s of byEpic[epic]) {
    out += `\n**${s.key} — ${s.summary}**  ·  _${s.priority || "No priority"}_  ·  _${s.status}_`;
    if (s.labels.length) out += `  ·  labels: ${s.labels.join(", ")}`;
    out += `\n`;
    out += s.description ? clip(s.description).split("\n").map((l) => "> " + l).join("\n") : "> _(no description)_";
    out += `\n`;
  }
}

if (rest.length) {
  out += `\n## Other stories (${rest.length})\n\n`;
  out += rest.map((d) => `${d.key} [${d.status}] ${d.summary}`).join("  ·  ") + "\n";
}

console.log(out);
