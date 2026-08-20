import { describe, expect, it } from "vitest";
import {
  addRecord,
  clearRecords,
  computeSummary,
  isSameLocalDay,
  isValidWorkSessionCompleted,
  toRecord,
} from "../src/session-store.js";

const validEvent = {
  completed_at: "2026-08-20T09:30:00Z",
  duration_seconds: 1500,
  session_type: "WORK",
};

describe("isValidWorkSessionCompleted", () => {
  it("accepts a well-formed WORK completion event", () => {
    expect(isValidWorkSessionCompleted(validEvent)).toBe(true);
  });

  it("rejects non-object input", () => {
    expect(isValidWorkSessionCompleted(null)).toBe(false);
    expect(isValidWorkSessionCompleted(undefined)).toBe(false);
    expect(isValidWorkSessionCompleted("not-an-object")).toBe(false);
    expect(isValidWorkSessionCompleted(42)).toBe(false);
    expect(isValidWorkSessionCompleted([validEvent])).toBe(false);
  });

  it("rejects missing required fields", () => {
    const { completed_at, ...rest } = validEvent;
    expect(isValidWorkSessionCompleted(rest)).toBe(false);
  });

  it("rejects additional properties (additionalProperties: false)", () => {
    expect(isValidWorkSessionCompleted({ ...validEvent, extra: "nope" })).toBe(false);
  });

  it("rejects a non-ISO completed_at string", () => {
    expect(isValidWorkSessionCompleted({ ...validEvent, completed_at: "not-a-date" })).toBe(false);
    expect(
      isValidWorkSessionCompleted({ ...validEvent, completed_at: "2026/08/20 09:30" }),
    ).toBe(false);
  });

  it("rejects a completed_at with a calendar date that does not exist", () => {
    // Date.parse は "2026-02-30" のような実在しない日付を寛容に丸めてしまう
    // （"2026-03-02" 等として解釈される）ため、桁の形だけでなく実在する暦日かどうかを検証する。
    expect(isValidWorkSessionCompleted({ ...validEvent, completed_at: "2026-02-30T10:00:00Z" })).toBe(
      false,
    );
    expect(isValidWorkSessionCompleted({ ...validEvent, completed_at: "2026-04-31T10:00:00Z" })).toBe(
      false,
    );
    expect(isValidWorkSessionCompleted({ ...validEvent, completed_at: "2026-08-20T25:00:00Z" })).toBe(
      false,
    );
  });

  it("accepts a leap-day completed_at in a leap year", () => {
    expect(isValidWorkSessionCompleted({ ...validEvent, completed_at: "2024-02-29T10:00:00Z" })).toBe(
      true,
    );
  });

  it("rejects duration_seconds that is not a positive integer", () => {
    expect(isValidWorkSessionCompleted({ ...validEvent, duration_seconds: 0 })).toBe(false);
    expect(isValidWorkSessionCompleted({ ...validEvent, duration_seconds: -5 })).toBe(false);
    expect(isValidWorkSessionCompleted({ ...validEvent, duration_seconds: 12.5 })).toBe(false);
    expect(isValidWorkSessionCompleted({ ...validEvent, duration_seconds: "1500" })).toBe(false);
  });

  it("rejects a session_type other than WORK", () => {
    expect(isValidWorkSessionCompleted({ ...validEvent, session_type: "BREAK" })).toBe(false);
    expect(isValidWorkSessionCompleted({ ...validEvent, session_type: "" })).toBe(false);
  });
});

describe("toRecord", () => {
  it("keeps only completed_at and duration_seconds", () => {
    expect(toRecord(validEvent)).toEqual({
      completed_at: "2026-08-20T09:30:00Z",
      duration_seconds: 1500,
    });
  });
});

describe("addRecord", () => {
  it("appends a valid event to the records array without mutating the original", () => {
    const original = [];
    const result = addRecord(original, validEvent);
    expect(result.ok).toBe(true);
    expect(result.records).toEqual([
      { completed_at: "2026-08-20T09:30:00Z", duration_seconds: 1500 },
    ]);
    expect(original).toEqual([]); // イミュータブルであること
  });

  it("does not append an invalid event and reports rejection", () => {
    const original = [{ completed_at: "2026-08-20T08:00:00Z", duration_seconds: 900 }];
    const result = addRecord(original, { ...validEvent, session_type: "BREAK" });
    expect(result.ok).toBe(false);
    expect(result.records).toBe(original);
    expect(result.reason).toBe("invalid_work_session_completed");
  });
});

describe("clearRecords", () => {
  it("always returns an empty array", () => {
    expect(clearRecords()).toEqual([]);
  });
});

describe("isSameLocalDay", () => {
  it("returns true for timestamps on the same local calendar day", () => {
    const now = new Date(2026, 7, 20, 23, 0, 0); // 2026-08-20 local
    expect(isSameLocalDay("2026-08-20T01:00:00", now)).toBe(true);
  });

  it("returns false across a local day boundary", () => {
    const now = new Date(2026, 7, 20, 0, 30, 0); // 2026-08-20 local, just after midnight
    expect(isSameLocalDay("2026-08-19T23:59:00", now)).toBe(false);
  });
});

describe("computeSummary", () => {
  it("returns zero counts and an empty records array when there are no records", () => {
    const summary = computeSummary([]);
    expect(summary).toEqual({ total_count: 0, today_count: 0, records: [] });
  });

  it("counts total and today separately, and sorts records newest first", () => {
    const now = new Date(2026, 7, 20, 12, 0, 0); // 2026-08-20 12:00 local
    const records = [
      { completed_at: "2026-08-20T00:30:00", duration_seconds: 1500 }, // today
      { completed_at: "2026-08-19T09:00:00", duration_seconds: 1500 }, // yesterday
      { completed_at: "2026-08-20T10:00:00", duration_seconds: 300 }, // today, later
    ];
    const summary = computeSummary(records, now);
    expect(summary.total_count).toBe(3);
    expect(summary.today_count).toBe(2);
    expect(summary.records.map((r) => r.completed_at)).toEqual([
      "2026-08-20T10:00:00",
      "2026-08-20T00:30:00",
      "2026-08-19T09:00:00",
    ]);
  });

  it("recomputes today_count correctly once the date rolls over", () => {
    const records = [{ completed_at: "2026-08-19T23:59:00", duration_seconds: 1500 }];
    const beforeMidnight = new Date(2026, 7, 19, 23, 59, 30);
    const afterMidnight = new Date(2026, 7, 20, 0, 0, 30);
    expect(computeSummary(records, beforeMidnight).today_count).toBe(1);
    expect(computeSummary(records, afterMidnight).today_count).toBe(0);
  });
});
