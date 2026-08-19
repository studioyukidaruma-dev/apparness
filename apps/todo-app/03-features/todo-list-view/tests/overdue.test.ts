import { describe, expect, it } from "vitest";
import { isOverdue } from "../src/overdue.js";

const NOW = new Date("2026-08-19T12:00:00Z");

describe("isOverdue", () => {
  it("未完了かつ期限が過去なら true を返す", () => {
    expect(isOverdue({ dueDate: "2026-08-18", completed: false }, NOW)).toBe(true);
  });

  it("未完了かつ期限が当日なら false を返す", () => {
    expect(isOverdue({ dueDate: "2026-08-19", completed: false }, NOW)).toBe(false);
  });

  it("未完了かつ期限が未来なら false を返す", () => {
    expect(isOverdue({ dueDate: "2026-08-20", completed: false }, NOW)).toBe(false);
  });

  it("期限が過去でも完了済みなら false を返す", () => {
    expect(isOverdue({ dueDate: "2026-08-01", completed: true }, NOW)).toBe(false);
  });

  it("dueDate が null なら false を返す", () => {
    expect(isOverdue({ dueDate: null, completed: false }, NOW)).toBe(false);
  });
});
