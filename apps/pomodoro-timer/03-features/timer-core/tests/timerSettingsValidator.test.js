import { describe, it, expect } from "vitest";
import { validateTimerSettings } from "../src/timerSettingsValidator.js";

const validSettings = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  sessions_until_long_break: 4,
  sound_enabled: true,
};

describe("validateTimerSettings", () => {
  it("accepts a valid settings object", () => {
    expect(validateTimerSettings(validSettings)).toEqual({ valid: true });
  });

  it("rejects null", () => {
    const result = validateTimerSettings(null);
    expect(result.valid).toBe(false);
  });

  it("rejects a non-object", () => {
    const result = validateTimerSettings("not an object");
    expect(result.valid).toBe(false);
  });

  it("rejects an array", () => {
    const result = validateTimerSettings([]);
    expect(result.valid).toBe(false);
  });

  it("rejects missing required fields", () => {
    const { sound_enabled, ...missingSoundEnabled } = validSettings;
    const result = validateTimerSettings(missingSoundEnabled);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing required field: sound_enabled");
  });

  it("rejects unexpected additional fields", () => {
    const result = validateTimerSettings({ ...validSettings, extra_field: 1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("unexpected field: extra_field");
  });

  it("rejects out-of-range work_minutes", () => {
    expect(validateTimerSettings({ ...validSettings, work_minutes: 0 }).valid).toBe(false);
    expect(validateTimerSettings({ ...validSettings, work_minutes: 181 }).valid).toBe(false);
  });

  it("rejects non-integer values", () => {
    expect(validateTimerSettings({ ...validSettings, work_minutes: 25.5 }).valid).toBe(false);
  });

  it("rejects out-of-range sessions_until_long_break", () => {
    expect(
      validateTimerSettings({ ...validSettings, sessions_until_long_break: 0 }).valid,
    ).toBe(false);
    expect(
      validateTimerSettings({ ...validSettings, sessions_until_long_break: 13 }).valid,
    ).toBe(false);
  });

  it("rejects a non-boolean sound_enabled", () => {
    expect(validateTimerSettings({ ...validSettings, sound_enabled: "yes" }).valid).toBe(false);
  });

  it("accepts boundary values", () => {
    const boundary = {
      work_minutes: 1,
      short_break_minutes: 1,
      long_break_minutes: 60,
      sessions_until_long_break: 12,
      sound_enabled: false,
    };
    expect(validateTimerSettings(boundary)).toEqual({ valid: true });
  });
});
