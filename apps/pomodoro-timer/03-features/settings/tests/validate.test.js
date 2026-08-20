import { describe, it, expect } from "vitest";
import { validateSettingsInput, DEFAULT_SETTINGS, LIMITS } from "../src/validate.js";

const VALID_INPUT = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  sessions_until_long_break: 4,
  sound_enabled: true,
};

describe("validateSettingsInput", () => {
  it("accepts a fully valid input and returns a normalized value", () => {
    const result = validateSettingsInput(VALID_INPUT);
    expect(result.valid).toBe(true);
    expect(result.value).toEqual(VALID_INPUT);
  });

  it("accepts the documented default settings", () => {
    const result = validateSettingsInput(DEFAULT_SETTINGS);
    expect(result.valid).toBe(true);
  });

  it("rejects non-object input", () => {
    expect(validateSettingsInput(null).valid).toBe(false);
    expect(validateSettingsInput(undefined).valid).toBe(false);
    expect(validateSettingsInput("not an object").valid).toBe(false);
    expect(validateSettingsInput(42).valid).toBe(false);
    expect(validateSettingsInput([]).valid).toBe(false);
  });

  it("rejects when a required field is missing", () => {
    for (const field of Object.keys(VALID_INPUT)) {
      const input = { ...VALID_INPUT };
      delete input[field];
      const result = validateSettingsInput(input);
      expect(result.valid, `missing ${field} should be invalid`).toBe(false);
      expect(result.errors.some((e) => e.field === field)).toBe(true);
    }
  });

  describe.each(Object.entries(LIMITS))("%s boundaries", (field, { min, max }) => {
    it(`accepts the minimum value (${min})`, () => {
      const input = { ...VALID_INPUT, [field]: min };
      expect(validateSettingsInput(input).valid).toBe(true);
    });

    it(`accepts the maximum value (${max})`, () => {
      const input = { ...VALID_INPUT, [field]: max };
      expect(validateSettingsInput(input).valid).toBe(true);
    });

    it(`rejects one below the minimum (${min - 1})`, () => {
      const input = { ...VALID_INPUT, [field]: min - 1 };
      const result = validateSettingsInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === field)).toBe(true);
    });

    it(`rejects one above the maximum (${max + 1})`, () => {
      const input = { ...VALID_INPUT, [field]: max + 1 };
      const result = validateSettingsInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === field)).toBe(true);
    });

    it("rejects zero", () => {
      const input = { ...VALID_INPUT, [field]: 0 };
      expect(validateSettingsInput(input).valid).toBe(false);
    });

    it("rejects negative numbers", () => {
      const input = { ...VALID_INPUT, [field]: -1 };
      expect(validateSettingsInput(input).valid).toBe(false);
    });

    it("rejects decimals", () => {
      const input = { ...VALID_INPUT, [field]: min + 0.5 };
      expect(validateSettingsInput(input).valid).toBe(false);
    });

    it("rejects NaN", () => {
      const input = { ...VALID_INPUT, [field]: NaN };
      expect(validateSettingsInput(input).valid).toBe(false);
    });

    it("rejects Infinity", () => {
      const input = { ...VALID_INPUT, [field]: Infinity };
      expect(validateSettingsInput(input).valid).toBe(false);
    });

    it("rejects numeric strings (type must be integer, not stringified)", () => {
      const input = { ...VALID_INPUT, [field]: String(min) };
      expect(validateSettingsInput(input).valid).toBe(false);
    });
  });

  it("rejects when sound_enabled is not a boolean", () => {
    for (const bad of [1, 0, "true", "false", null, undefined]) {
      const input = { ...VALID_INPUT, sound_enabled: bad };
      const result = validateSettingsInput(input);
      if (bad === undefined) {
        // undefined は「missing」として required チェックに落ちる
        expect(result.valid).toBe(false);
        continue;
      }
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "sound_enabled")).toBe(true);
    }
  });

  it("accepts sound_enabled: false", () => {
    const input = { ...VALID_INPUT, sound_enabled: false };
    expect(validateSettingsInput(input).valid).toBe(true);
  });

  it("collects multiple errors at once when several fields are invalid", () => {
    const result = validateSettingsInput({
      work_minutes: 0,
      short_break_minutes: 999,
      long_break_minutes: 15,
      sessions_until_long_break: 4,
      sound_enabled: "yes",
    });
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(["short_break_minutes", "sound_enabled", "work_minutes"]);
  });

  it("ignores unrelated extra properties on the input without leaking them into the value", () => {
    const result = validateSettingsInput({ ...VALID_INPUT, extra_field: "should be dropped" });
    expect(result.valid).toBe(true);
    expect(result.value).not.toHaveProperty("extra_field");
  });
});
