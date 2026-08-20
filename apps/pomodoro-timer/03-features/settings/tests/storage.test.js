import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DEFAULT_SETTINGS } from "../src/validate.js";
import {
  createFakeLocalStorage,
  createWriteFailingLocalStorage,
} from "./helpers/fakeLocalStorage.js";

const originalLocalStorage = globalThis.localStorage;

async function freshStorageModule() {
  // モジュールキャッシュを避けるため、テストごとに動的 import する必要はない
  // （storage.js はグローバルの localStorage を毎回参照する実装のため）。
  return import("../src/storage.js");
}

afterEach(() => {
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = originalLocalStorage;
  }
});

describe("loadSettings", () => {
  it("returns defaults when localStorage is unavailable", async () => {
    delete globalThis.localStorage;
    const { loadSettings } = await freshStorageModule();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults when nothing has been saved yet", async () => {
    globalThis.localStorage = createFakeLocalStorage();
    const { loadSettings } = await freshStorageModule();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults when the stored value is corrupted JSON", async () => {
    globalThis.localStorage = createFakeLocalStorage();
    globalThis.localStorage.setItem("pomodoro-timer:settings:v1", "{not valid json");
    const { loadSettings } = await freshStorageModule();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults when the stored value fails validation (e.g. out of range)", async () => {
    globalThis.localStorage = createFakeLocalStorage();
    globalThis.localStorage.setItem(
      "pomodoro-timer:settings:v1",
      JSON.stringify({ ...DEFAULT_SETTINGS, work_minutes: 9999 })
    );
    const { loadSettings } = await freshStorageModule();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("returns the saved value when present and valid", async () => {
    globalThis.localStorage = createFakeLocalStorage();
    const saved = { ...DEFAULT_SETTINGS, work_minutes: 50, sound_enabled: false };
    globalThis.localStorage.setItem("pomodoro-timer:settings:v1", JSON.stringify(saved));
    const { loadSettings } = await freshStorageModule();
    expect(loadSettings()).toEqual(saved);
  });
});

describe("persistSettings", () => {
  it("saves the value under the pomodoro-timer:settings:v1 key", async () => {
    globalThis.localStorage = createFakeLocalStorage();
    const { persistSettings, STORAGE_KEY } = await freshStorageModule();
    expect(STORAGE_KEY).toBe("pomodoro-timer:settings:v1");

    const result = persistSettings(DEFAULT_SETTINGS);
    expect(result).toEqual({ ok: true });
    expect(JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY))).toEqual(DEFAULT_SETTINGS);
  });

  it("returns STORAGE_UNAVAILABLE when localStorage is missing entirely", async () => {
    delete globalThis.localStorage;
    const { persistSettings } = await freshStorageModule();
    const result = persistSettings(DEFAULT_SETTINGS);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
  });

  it("returns STORAGE_UNAVAILABLE when setItem throws (e.g. private browsing quota)", async () => {
    globalThis.localStorage = createWriteFailingLocalStorage("pomodoro-timer:settings:v1");
    const { persistSettings } = await freshStorageModule();
    const result = persistSettings(DEFAULT_SETTINGS);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
  });
});
