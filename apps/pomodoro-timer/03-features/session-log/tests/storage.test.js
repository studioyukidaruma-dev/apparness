import { describe, expect, it } from "vitest";
import { STORAGE_KEY, loadRecords, saveRecords } from "../src/storage.js";

/**
 * Storage インターフェースを満たすフェイク（テスト用インメモリ実装）。
 */
function createFakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

function createThrowingStorage() {
  return {
    getItem: () => {
      throw new Error("boom");
    },
    setItem: () => {
      throw new Error("boom");
    },
  };
}

describe("loadRecords", () => {
  it("returns an empty array when nothing has been stored yet", () => {
    const storage = createFakeStorage();
    const result = loadRecords(storage);
    expect(result).toEqual({ ok: true, records: [] });
  });

  it("parses previously stored records", () => {
    const records = [{ completed_at: "2026-08-20T09:30:00Z", duration_seconds: 1500 }];
    const storage = createFakeStorage({ [STORAGE_KEY]: JSON.stringify(records) });
    const result = loadRecords(storage);
    expect(result).toEqual({ ok: true, records });
  });

  it("falls back to an empty array when stored data is not an array", () => {
    const storage = createFakeStorage({ [STORAGE_KEY]: JSON.stringify({ not: "an array" }) });
    const result = loadRecords(storage);
    expect(result).toEqual({ ok: true, records: [] });
  });

  it("falls back to an empty array when stored data is corrupted JSON", () => {
    const storage = createFakeStorage({ [STORAGE_KEY]: "{not valid json" });
    const result = loadRecords(storage);
    expect(result.ok).toBe(false);
    expect(result.records).toEqual([]);
    expect(result.error).toEqual({
      code: "STORAGE_UNAVAILABLE",
      message: expect.any(String),
    });
  });

  it("reports STORAGE_UNAVAILABLE without throwing when storage access itself fails", () => {
    const storage = createThrowingStorage();
    const result = loadRecords(storage);
    expect(result.ok).toBe(false);
    expect(result.records).toEqual([]);
    expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
  });

  it("reports STORAGE_UNAVAILABLE when no storage is available at all", () => {
    const result = loadRecords(null);
    expect(result.ok).toBe(false);
    expect(result.records).toEqual([]);
    expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
  });
});

describe("saveRecords", () => {
  it("persists records as a JSON string under the namespaced key", () => {
    const storage = createFakeStorage();
    const records = [{ completed_at: "2026-08-20T09:30:00Z", duration_seconds: 1500 }];
    const result = saveRecords(records, storage);
    expect(result).toEqual({ ok: true });
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(records));
  });

  it("reports STORAGE_UNAVAILABLE without throwing when the write fails", () => {
    const storage = createThrowingStorage();
    const result = saveRecords([], storage);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
  });
});
