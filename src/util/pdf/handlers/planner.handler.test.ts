import { describe, expect, it } from "bun:test";
import {
  mergePlannerDateEntries,
  normalizePlannerDateKey,
} from "./planner-date-merge";
import { estimatePlannerPageCount } from "./planner-page-count";

describe("normalizePlannerDateKey", () => {
  it("normalizes timestamps to YYYY-MM-DD", () => {
    expect(normalizePlannerDateKey("2026-08-24T10:20:30.000Z")).toBe(
      "2026-08-24",
    );
  });

  it("rejects unsupported formats", () => {
    expect(normalizePlannerDateKey("2026/08/24")).toBeNull();
    expect(normalizePlannerDateKey("24-08-2026")).toBeNull();
  });

  it("rejects impossible calendar dates", () => {
    expect(normalizePlannerDateKey("2026-02-29")).toBeNull();
    expect(normalizePlannerDateKey("2026-13-01")).toBeNull();
    expect(normalizePlannerDateKey("2026-04-31")).toBeNull();
  });
});

describe("mergePlannerDateEntries", () => {
  it("normalizes holiday dates containing a timestamp", () => {
    const merged = mergePlannerDateEntries([
      { date: "2026-08-24T00:00:00.000Z", name: "Feiertag" },
    ]);

    expect(merged.get("2026-08-24")).toBe("Feiertag");
    expect(merged.size).toBe(1);
  });

  it("lets custom dates override holidays on the same day", () => {
    const merged = mergePlannerDateEntries(
      [{ date: "2026-12-24", name: "Heiligabend" }],
      [{ date: "2026-12-24T09:30:00.000Z", name: "Weihnachtsfeier" }],
    );

    expect(merged.get("2026-12-24")).toBe("Weihnachtsfeier");
    expect(merged.size).toBe(1);
  });

  it("keeps both entries when custom date does not collide", () => {
    const merged = mergePlannerDateEntries(
      [{ date: "2026-05-01", name: "Tag der Arbeit" }],
      [{ date: "2026-05-02", name: "Sportfest" }],
    );

    expect(merged.get("2026-05-01")).toBe("Tag der Arbeit");
    expect(merged.get("2026-05-02")).toBe("Sportfest");
    expect(merged.size).toBe(2);
  });

  it("skips entries that normalize to empty keys", () => {
    const merged = mergePlannerDateEntries(
      [{ date: "T00:00:00.000Z", name: "Broken holiday" }],
      [{ date: "T12:00:00.000Z", name: "Broken custom date" }],
    );

    expect(merged.size).toBe(0);
  });

  it("keeps last custom entry for duplicate custom dates", () => {
    const merged = mergePlannerDateEntries([], [
      { date: "2026-10-10", name: "Event A" },
      { date: "2026-10-10T14:00:00.000Z", name: "Event B" },
    ]);

    expect(merged.get("2026-10-10")).toBe("Event B");
    expect(merged.size).toBe(1);
  });

  it("applies the same date-format validation path to holidays and custom dates", () => {
    const merged = mergePlannerDateEntries(
      [
        { date: "2026/12/24", name: "Invalid holiday format" },
        { date: "2026-12-24T00:00:00.000Z", name: "Valid holiday timestamp" },
      ],
      [
        { date: "24-12-2026", name: "Invalid custom format" },
        { date: "2026-12-25T13:00:00.000Z", name: "Valid custom timestamp" },
      ],
    );

    expect(merged.get("2026-12-24")).toBe("Valid holiday timestamp");
    expect(merged.get("2026-12-25")).toBe("Valid custom timestamp");
    expect(merged.size).toBe(2);
  });
});

describe("planner page count estimation", () => {
  it("includes alignment pages when module starts on an even page", () => {
    const pageCount = estimatePlannerPageCount({
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date("2026-01-01T00:00:00.000Z"),
      currentPageCount: 4,
      previewMode: false,
    });

    expect(pageCount).toBe(5);
  });

  it("omits initial alignment when module starts on an odd page", () => {
    const pageCount = estimatePlannerPageCount({
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date("2026-01-01T00:00:00.000Z"),
      currentPageCount: 5,
      previewMode: false,
    });

    expect(pageCount).toBe(4);
  });

  it("caps estimation to preview week limits when previewMode is enabled", () => {
    const pageCount = estimatePlannerPageCount({
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date("2026-04-01T00:00:00.000Z"),
      currentPageCount: 4,
      previewMode: true,
    });

    expect(pageCount).toBe(9);
  });
});
