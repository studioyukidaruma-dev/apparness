import { describe, it, expect, afterEach } from "vitest";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "../src/settings.js";
import {
  createFakeLocalStorage,
  createWriteFailingLocalStorage,
} from "./helpers/fakeLocalStorage.js";

const originalLocalStorage = globalThis.localStorage;

afterEach(() => {
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = originalLocalStorage;
  }
});

describe("getSettings", () => {
  it("returns default timer_settings on first access (no localStorage entry)", () => {
    globalThis.localStorage = createFakeLocalStorage();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("saveSettings", () => {
  it("persists valid input and returns the normalized value", () => {
    globalThis.localStorage = createFakeLocalStorage();
    const input = {
      work_minutes: 45,
      short_break_minutes: 10,
      long_break_minutes: 20,
      sessions_until_long_break: 3,
      sound_enabled: false,
    };

    const result = saveSettings(input);
    expect(result).toEqual({ ok: true, value: input });
    expect(getSettings()).toEqual(input);
  });

  it("rejects invalid input with INVALID_INPUT and does not persist it", () => {
    globalThis.localStorage = createFakeLocalStorage();
    const before = getSettings();

    const result = saveSettings({
      work_minutes: 0,
      short_break_minutes: 5,
      long_break_minutes: 15,
      sessions_until_long_break: 4,
      sound_enabled: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("INVALID_INPUT");
    expect(getSettings()).toEqual(before);
  });

  it("returns STORAGE_UNAVAILABLE when the underlying write fails, without throwing", () => {
    globalThis.localStorage = createWriteFailingLocalStorage("pomodoro-timer:settings:v1");

    const result = saveSettings(DEFAULT_SETTINGS);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
  });

  it("does not persist partially-typed input (e.g. decimal minutes)", () => {
    globalThis.localStorage = createFakeLocalStorage();
    const result = saveSettings({
      work_minutes: 25.5,
      short_break_minutes: 5,
      long_break_minutes: 15,
      sessions_until_long_break: 4,
      sound_enabled: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("INVALID_INPUT");
  });
});
