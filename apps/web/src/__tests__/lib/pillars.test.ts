import { describe, it, expect } from "vitest";
import { PILLAR_META, getPillarMeta } from "@/lib/pillars";

describe("PILLAR_META", () => {
  it("contains all six pillars", () => {
    const pillars = ["career", "wealth", "health", "knowledge", "relationships", "personal"];
    for (const pillar of pillars) {
      expect(PILLAR_META).toHaveProperty(pillar);
    }
  });

  it("each pillar has a label, icon, color, and bgColor", () => {
    for (const [, meta] of Object.entries(PILLAR_META)) {
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
      expect(typeof meta.icon).toBe("string");
      expect(meta.icon.length).toBeGreaterThan(0);
      expect(typeof meta.color).toBe("string");
      expect(meta.color.length).toBeGreaterThan(0);
      expect(typeof meta.bgColor).toBe("string");
      expect(meta.bgColor.length).toBeGreaterThan(0);
    }
  });

  it("career pillar has correct label", () => {
    expect(PILLAR_META.career.label).toBe("Career");
  });

  it("wealth pillar has correct label", () => {
    expect(PILLAR_META.wealth.label).toBe("Wealth");
  });

  it("health pillar has correct label", () => {
    expect(PILLAR_META.health.label).toBe("Health");
  });

  it("knowledge pillar has correct label", () => {
    expect(PILLAR_META.knowledge.label).toBe("Knowledge");
  });

  it("relationships pillar has correct label", () => {
    expect(PILLAR_META.relationships.label).toBe("Relationships");
  });

  it("personal pillar has correct label", () => {
    expect(PILLAR_META.personal.label).toBe("Personal");
  });
});

describe("getPillarMeta", () => {
  it("returns correct meta for a known pillar", () => {
    const meta = getPillarMeta("career");
    expect(meta).toEqual(PILLAR_META.career);
  });

  it("returns correct meta for health pillar", () => {
    const meta = getPillarMeta("health");
    expect(meta).toEqual(PILLAR_META.health);
  });

  it("returns correct meta for all known pillars", () => {
    const pillars = ["career", "wealth", "health", "knowledge", "relationships", "personal"];
    for (const pillar of pillars) {
      const meta = getPillarMeta(pillar);
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
    }
  });

  it("returns a fallback for an unknown pillar", () => {
    const meta = getPillarMeta("unknown_pillar");
    expect(meta).toBeDefined();
    expect(meta.label).toBe("unknown_pillar");
    expect(meta.icon).toBe("Circle");
  });

  it("fallback preserves the unknown pillar name as label", () => {
    const meta = getPillarMeta("custom_pillar");
    expect(meta.label).toBe("custom_pillar");
  });

  it("fallback has muted color", () => {
    const meta = getPillarMeta("nonexistent");
    expect(meta.color).toBe("text-muted-foreground");
  });

  it("fallback has muted bgColor", () => {
    const meta = getPillarMeta("nonexistent");
    expect(meta.bgColor).toBe("bg-muted/10");
  });
});
