import { describe, expect, it } from "vitest";
import { createSessionLog } from "../src/session-log.js";
import { STORAGE_KEY } from "../src/storage.js";

function createFakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
}

const validEvent = {
  completed_at: "2026-08-20T09:30:00Z",
  duration_seconds: 1500,
  session_type: "WORK",
};

describe("SessionLog", () => {
  it("starts with an empty summary when there is no prior data", () => {
    const sessionLog = createSessionLog({ storage: createFakeStorage() });
    expect(sessionLog.getSummary()).toEqual({ total_count: 0, today_count: 0, records: [] });
    expect(sessionLog.getError()).toBeNull();
  });

  it("adds a record on onWorkSessionCompleted and persists it", () => {
    const storage = createFakeStorage();
    const sessionLog = createSessionLog({ storage });
    const summary = sessionLog.onWorkSessionCompleted(validEvent);

    expect(summary.total_count).toBe(1);
    expect(summary.records).toEqual([
      { completed_at: "2026-08-20T09:30:00Z", duration_seconds: 1500 },
    ]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toEqual([
      { completed_at: "2026-08-20T09:30:00Z", duration_seconds: 1500 },
    ]);
  });

  it("ignores an invalid work_session_completed event without throwing", () => {
    const sessionLog = createSessionLog({ storage: createFakeStorage() });
    const summary = sessionLog.onWorkSessionCompleted({ session_type: "BREAK" });
    expect(summary.total_count).toBe(0);
  });

  it("clears all records via clearAll", () => {
    const storage = createFakeStorage();
    const sessionLog = createSessionLog({ storage });
    sessionLog.onWorkSessionCompleted(validEvent);
    const summary = sessionLog.clearAll();
    expect(summary).toEqual({ total_count: 0, today_count: 0, records: [] });
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toEqual([]);
  });

  it("notifies subscribers when records change", () => {
    const sessionLog = createSessionLog({ storage: createFakeStorage() });
    const seen = [];
    const unsubscribe = sessionLog.subscribe((summary) => seen.push(summary.total_count));

    sessionLog.onWorkSessionCompleted(validEvent);
    sessionLog.clearAll();
    unsubscribe();
    sessionLog.onWorkSessionCompleted(validEvent);

    expect(seen).toEqual([1, 0]); // unsubscribe後の変化は通知されない
  });

  it("loads previously persisted records on construction", () => {
    const existing = [{ completed_at: "2026-08-19T09:00:00Z", duration_seconds: 1500 }];
    const storage = createFakeStorage({ [STORAGE_KEY]: JSON.stringify(existing) });
    const sessionLog = createSessionLog({ storage });
    expect(sessionLog.getSummary().total_count).toBe(1);
  });

  it("surfaces a STORAGE_UNAVAILABLE error without crashing when storage is unusable", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("boom");
      },
      setItem: () => {
        throw new Error("boom");
      },
    };
    const sessionLog = createSessionLog({ storage: throwingStorage });
    expect(sessionLog.getError()).toEqual({ code: "STORAGE_UNAVAILABLE", message: expect.any(String) });

    // ストレージが使えなくても、メモリ内では動作を継続できる
    const summary = sessionLog.onWorkSessionCompleted(validEvent);
    expect(summary.total_count).toBe(1);
    expect(sessionLog.getError().code).toBe("STORAGE_UNAVAILABLE");
  });
});
