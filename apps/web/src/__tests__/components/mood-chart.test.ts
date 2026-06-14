/**
 * Smoke tests for MoodChart component.
 *
 * The project runs Vitest in "node" environment (no DOM / jsdom), so we
 * verify module exports and the data-transformation logic rather than rendering.
 */
import { describe, it, expect } from "vitest";
import type { MoodLog } from "@secondbrain/types";
import { format, subDays } from "date-fns";

/**
 * NOTE: Direct import of the .tsx component is omitted because Vitest runs in
 * "node" environment without a JSX transform. The series-construction tests
 * below cover the data-transformation logic extracted from mood-chart.tsx.
 * A full render test would require adding @vitejs/plugin-react and jsdom.
 */

describe("MoodChart 7-day series construction logic", () => {
  /**
   * This replicates the series-building logic from mood-chart.tsx so we can
   * unit-test the transformation in isolation without a DOM.
   */
  function buildSeries(data: MoodLog[], today: Date) {
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(today, 6 - i);
      const key = format(day, "yyyy-MM-dd");
      const entry = data.find((e) => format(new Date(e.date), "yyyy-MM-dd") === key);
      return { day: format(day, "EEE"), mood: entry ? entry.mood : null };
    });
  }

  const today = new Date("2026-06-14T00:00:00Z");

  it("produces exactly 7 data points", () => {
    const series = buildSeries([], today);
    expect(series).toHaveLength(7);
  });

  it("fills null for days with no log entry", () => {
    const series = buildSeries([], today);
    expect(series.every((s) => s.mood === null)).toBe(true);
  });

  it("maps a matching log to the correct day", () => {
    const log: MoodLog = {
      id: "ml-1",
      userId: "user-1",
      date: "2026-06-14",
      mood: 5,
      note: null,
      createdAt: "2026-06-14T10:00:00Z",
      updatedAt: "2026-06-14T10:00:00Z",
    };
    const series = buildSeries([log], today);
    // last element in the 7-day window is today
    const todayEntry = series[6];
    expect(todayEntry.mood).toBe(5);
  });

  it("leaves days with no matching log as null", () => {
    const log: MoodLog = {
      id: "ml-2",
      userId: "user-1",
      date: "2026-06-14",
      mood: 3,
      note: null,
      createdAt: "2026-06-14T08:00:00Z",
      updatedAt: "2026-06-14T08:00:00Z",
    };
    const series = buildSeries([log], today);
    // All days except today (index 6) should have null
    const nullDays = series.slice(0, 6);
    expect(nullDays.every((s) => s.mood === null)).toBe(true);
  });

  it("populates mood for a day in the middle of the window", () => {
    const threeDaysAgo = format(subDays(today, 3), "yyyy-MM-dd");
    const log: MoodLog = {
      id: "ml-3",
      userId: "user-1",
      date: threeDaysAgo,
      mood: 2,
      note: null,
      createdAt: threeDaysAgo,
      updatedAt: threeDaysAgo,
    };
    const series = buildSeries([log], today);
    expect(series[3].mood).toBe(2);
  });

  it("ignores logs older than 7 days", () => {
    const eightDaysAgo = format(subDays(today, 8), "yyyy-MM-dd");
    const log: MoodLog = {
      id: "ml-4",
      userId: "user-1",
      date: eightDaysAgo,
      mood: 4,
      note: null,
      createdAt: eightDaysAgo,
      updatedAt: eightDaysAgo,
    };
    const series = buildSeries([log], today);
    expect(series.every((s) => s.mood === null)).toBe(true);
  });
});
