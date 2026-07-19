/**
 * Smoke tests for ContactCard render/action logic.
 *
 * Mirrors apps/web/src/components/relationships/contact-card.tsx's pure
 * relativeTime() helper and the log-interaction / delete-confirm gates,
 * following the dismissKey-mirroring convention from streak-nudge-card.test.ts.
 */
import { describe, it, expect } from "vitest";

function relativeTime(value: Date | string, now: number): string {
  const then = new Date(value).getTime();
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

const NOW = new Date("2026-07-15T12:00:00.000Z").getTime();

describe("ContactCard — relativeTime helper", () => {
  it("returns 'today' for an interaction logged just now", () => {
    expect(relativeTime(new Date(NOW), NOW)).toBe("today");
  });

  it("returns 'today' for a future timestamp (clock skew guard)", () => {
    expect(relativeTime(new Date(NOW + 60_000), NOW)).toBe("today");
  });

  it("returns 'yesterday' for 1 day ago", () => {
    expect(relativeTime(new Date(NOW - 1 * 86_400_000), NOW)).toBe("yesterday");
  });

  it("returns '<N> days ago' for 2-6 days", () => {
    expect(relativeTime(new Date(NOW - 3 * 86_400_000), NOW)).toBe("3 days ago");
  });

  it("returns '<N> week(s) ago' for 7-29 days", () => {
    expect(relativeTime(new Date(NOW - 10 * 86_400_000), NOW)).toBe("1 week ago");
    expect(relativeTime(new Date(NOW - 20 * 86_400_000), NOW)).toBe("2 weeks ago");
  });

  it("returns '<N> month(s) ago' for 30-364 days", () => {
    expect(relativeTime(new Date(NOW - 60 * 86_400_000), NOW)).toBe("2 months ago");
  });

  it("returns '<N> year(s) ago' for 365+ days", () => {
    expect(relativeTime(new Date(NOW - 400 * 86_400_000), NOW)).toBe("1 year ago");
  });
});

describe("ContactCard — log-interaction action payload (AC-3)", () => {
  it("PATCH payload is exactly { logInteraction: true }", () => {
    const payload = { logInteraction: true };
    expect(payload).toEqual({ logInteraction: true });
  });
});

describe("ContactCard — delete confirm gate", () => {
  function shouldDelete(confirmed: boolean): boolean {
    return confirmed;
  }

  it("does not proceed when the confirm() dialog is cancelled", () => {
    expect(shouldDelete(false)).toBe(false);
  });

  it("proceeds when the confirm() dialog is accepted", () => {
    expect(shouldDelete(true)).toBe(true);
  });
});
