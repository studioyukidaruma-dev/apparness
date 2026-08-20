import { describe, expect, it } from "vitest";
import { formatDuration, formatDateTime } from "../src/format.js";

describe("formatDuration", () => {
  it("formats whole minutes as mm:ss", () => {
    expect(formatDuration(1500)).toBe("25:00");
  });

  it("pads seconds under 10", () => {
    expect(formatDuration(65)).toBe("1:05");
  });

  it("treats non-positive/invalid input as 0", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(-10)).toBe("0:00");
    expect(formatDuration(Number.NaN)).toBe("0:00");
  });
});

describe("formatDateTime", () => {
  it("returns the original string when it cannot be parsed", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });

  it("formats a valid ISO string without throwing", () => {
    const formatted = formatDateTime("2026-08-20T09:30:00Z");
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });
});
