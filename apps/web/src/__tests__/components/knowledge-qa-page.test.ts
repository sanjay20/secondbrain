/**
 * Smoke tests for knowledge-qa/page.tsx utility logic.
 *
 * The project runs Vitest in "node" environment (no jsdom), so — mirroring
 * ai-coach-page.test.ts — we verify the page's logic-level helper functions and
 * render predicates independently instead of mounting JSX.
 *
 * Covers:
 *   - parseSources: returns { text, sources: [] } when no sources block present
 *   - parseSources: strips the <<<SOURCES>>>...<<<END_SOURCES>>> block from the text
 *   - parseSources: extracts a valid sources array (type/id/title) from the block
 *   - parseSources: degrades gracefully on a partial block (no end marker yet,
 *     mid-stream) — text is shown without the block, sources is empty
 *   - parseSources: degrades gracefully on invalid JSON inside a complete block —
 *     no throw, sources empty
 *   - parseSources: empty sources array in the block yields sources: []
 *   - Empty-state render predicate: shown only when hasKnowledge === false
 *   - Sources-list render predicate: shown only when a parsed message has >=1 source
 */
import { describe, it, expect } from "vitest";

// ── Replicate parseSources from the page ─────────────────────────────────────
//
// Kept in sync with apps/web/src/app/(dashboard)/knowledge-qa/page.tsx.

const SOURCES_START = "<<<SOURCES>>>";
const SOURCES_END = "<<<END_SOURCES>>>";

interface Source {
  type: "note" | "highlight";
  id: string;
  title?: string;
}

function parseSources(content: string): { text: string; sources: Source[] } {
  const start = content.indexOf(SOURCES_START);
  if (start === -1) return { text: content, sources: [] };

  const end = content.indexOf(SOURCES_END, start);
  const jsonStr =
    end === -1
      ? content.slice(start + SOURCES_START.length)
      : content.slice(start + SOURCES_START.length, end);
  const text = (
    content.slice(0, start) + (end === -1 ? "" : content.slice(end + SOURCES_END.length))
  ).trim();

  let sources: Source[] = [];
  try {
    const parsed = JSON.parse(jsonStr.trim()) as { sources?: Source[] };
    if (Array.isArray(parsed.sources)) sources = parsed.sources;
  } catch {
    // block not fully streamed / invalid JSON — degrade to "answer shown, no source list"
  }
  return { text, sources };
}

// ── Replicate the page's render predicates ────────────────────────────────────

function shouldShowEmptyState(hasKnowledge: boolean | null): boolean {
  return hasKnowledge === false;
}

function hasSourcesToRender(content: string): boolean {
  return parseSources(content).sources.length > 0;
}

// ── parseSources tests ────────────────────────────────────────────────────────

describe("parseSources — FR-4 / AC-3 source block extraction", () => {
  it("returns { text, sources: [] } when no sources block present", () => {
    const result = parseSources("Just a normal reply with no citations.");
    expect(result.text).toBe("Just a normal reply with no citations.");
    expect(result.sources).toEqual([]);
  });

  it("strips the sources block from the text", () => {
    const content = `Here is what I found.\n${SOURCES_START}\n{"sources":[{"type":"note","id":"note-1","title":"Deep work"}]}\n${SOURCES_END}`;
    const { text } = parseSources(content);
    expect(text).not.toContain(SOURCES_START);
    expect(text).not.toContain(SOURCES_END);
    expect(text.trim()).toBe("Here is what I found.");
  });

  it("extracts a valid source from a complete block", () => {
    const content = `Found it!\n${SOURCES_START}\n{"sources":[{"type":"note","id":"note-1","title":"Deep work"}]}\n${SOURCES_END}`;
    const { sources } = parseSources(content);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ type: "note", id: "note-1", title: "Deep work" });
  });

  it("extracts multiple sources (note + highlight) from one block", () => {
    const content = `Here's what I found.\n${SOURCES_START}\n{"sources":[{"type":"note","id":"note-1","title":"Deep work"},{"type":"highlight","id":"hl-1","title":"Atomic Habits"}]}\n${SOURCES_END}`;
    const { sources } = parseSources(content);
    expect(sources).toHaveLength(2);
    expect(sources[0].type).toBe("note");
    expect(sources[1].type).toBe("highlight");
  });

  it("returns sources: [] for an empty sources array in the block", () => {
    const content = `Nothing relevant.\n${SOURCES_START}\n{"sources":[]}\n${SOURCES_END}`;
    const { sources } = parseSources(content);
    expect(sources).toEqual([]);
  });

  it("degrades gracefully on a partial block mid-stream (no end marker) — no throw", () => {
    const content = `Here's my answer so far.\n${SOURCES_START}\n{"sources":[{"type":"note"`;
    expect(() => parseSources(content)).not.toThrow();
  });

  it("partial mid-stream block shows the prose text without the raw block", () => {
    const content = `Here's my answer so far.\n${SOURCES_START}\n{"sources":[{"type":"note"`;
    const { text } = parseSources(content);
    expect(text).toBe("Here's my answer so far.");
    expect(text).not.toContain(SOURCES_START);
  });

  it("partial mid-stream block yields no source list (sources empty)", () => {
    const content = `Here's my answer so far.\n${SOURCES_START}\n{"sources":[{"type":"note"`;
    const { sources } = parseSources(content);
    expect(sources).toEqual([]);
  });

  it("degrades gracefully on invalid JSON inside a complete block — no throw, sources empty", () => {
    const content = `An answer.\n${SOURCES_START}\nnot valid json at all\n${SOURCES_END}`;
    expect(() => parseSources(content)).not.toThrow();
    const { text, sources } = parseSources(content);
    expect(sources).toEqual([]);
    // The prose text is still shown even though the block was malformed.
    expect(text).toBe("An answer.");
  });
});

// ── Empty-state render predicate ──────────────────────────────────────────────

describe("Empty-state render predicate — AC-4", () => {
  it("shows the empty state when hasKnowledge is false", () => {
    expect(shouldShowEmptyState(false)).toBe(true);
  });

  it("does not show the empty state when hasKnowledge is true", () => {
    expect(shouldShowEmptyState(true)).toBe(false);
  });

  it("does not show the empty state while hasKnowledge is still null (loading)", () => {
    expect(shouldShowEmptyState(null)).toBe(false);
  });
});

// ── Sources-list render predicate ─────────────────────────────────────────────

describe("Sources-list render predicate — FR-4 / AC-3", () => {
  it("renders a sources list when the assistant message carries >=1 source", () => {
    const content = `Found it.\n${SOURCES_START}\n{"sources":[{"type":"highlight","id":"hl-1","title":"Atomic Habits"}]}\n${SOURCES_END}`;
    expect(hasSourcesToRender(content)).toBe(true);
  });

  it("does not render a sources list when the block has an empty sources array", () => {
    const content = `Nothing relevant.\n${SOURCES_START}\n{"sources":[]}\n${SOURCES_END}`;
    expect(hasSourcesToRender(content)).toBe(false);
  });

  it("does not render a sources list when no block is present", () => {
    expect(hasSourcesToRender("Plain answer, no citations.")).toBe(false);
  });
});
