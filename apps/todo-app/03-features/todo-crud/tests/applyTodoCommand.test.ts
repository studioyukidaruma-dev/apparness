import { describe, expect, it, vi } from "vitest";
import { applyTodoCommand } from "../src/applyTodoCommand.js";
import { TodoCrudError } from "../src/errors.js";
import type { TodoItem } from "../src/types.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "6f2a9a2e-5b8c-4b2b-9f9a-4a2b2c1e0001",
    title: "既存タスク",
    completed: false,
    dueDate: null,
    priority: "medium",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("applyTodoCommand", () => {
  describe("add", () => {
    it("新しいTodoを末尾に追加する", () => {
      const before: TodoItem[] = [];
      const after = applyTodoCommand(before, {
        type: "add",
        title: "牛乳を買う",
        dueDate: "2026-08-20",
        priority: "high",
        tags: ["買い物"],
      });

      expect(after).toHaveLength(1);
      const created = after[0]!;
      expect(created.title).toBe("牛乳を買う");
      expect(created.completed).toBe(false);
      expect(created.dueDate).toBe("2026-08-20");
      expect(created.priority).toBe("high");
      expect(created.tags).toEqual(["買い物"]);
      expect(created.id).toMatch(UUID_RE);
      expect(created.createdAt).toBe(created.updatedAt);
      expect(() => new Date(created.createdAt).toISOString()).not.toThrow();
    });

    it("既存の配列を破壊しない", () => {
      const before = [makeTodo()];
      const beforeSnapshot = JSON.parse(JSON.stringify(before));
      applyTodoCommand(before, {
        type: "add",
        title: "新規",
        dueDate: null,
        priority: "low",
        tags: [],
      });
      expect(before).toEqual(beforeSnapshot);
    });

    it("dueDateを省略した場合はnullになる", () => {
      const after = applyTodoCommand([], {
        type: "add",
        title: "期限なし",
        priority: "medium",
        tags: [],
      });
      expect(after[0]!.dueDate).toBeNull();
    });

    it("titleが空文字の場合はEMPTY_TITLEを投げる", () => {
      expect(() =>
        applyTodoCommand([], {
          type: "add",
          title: "",
          priority: "medium",
          tags: [],
        }),
      ).toThrowError(TodoCrudError);

      try {
        applyTodoCommand([], {
          type: "add",
          title: "",
          priority: "medium",
          tags: [],
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TodoCrudError);
        expect((e as TodoCrudError).code).toBe("EMPTY_TITLE");
      }
    });

    it("titleが空白のみの場合はEMPTY_TITLEを投げる", () => {
      expect(() =>
        applyTodoCommand([], {
          type: "add",
          title: "   ",
          priority: "medium",
          tags: [],
        }),
      ).toThrowError(
        expect.objectContaining({ code: "EMPTY_TITLE" }) as unknown as Error,
      );
    });
  });

  describe("edit", () => {
    it("既存Todoのタイトル・期限・優先度・タグを更新する", () => {
      const before = [makeTodo()];
      const after = applyTodoCommand(before, {
        type: "edit",
        id: before[0]!.id,
        title: "更新後タイトル",
        dueDate: "2026-09-01",
        priority: "low",
        tags: ["仕事", "重要"],
      });

      expect(after).toHaveLength(1);
      const edited = after[0]!;
      expect(edited.id).toBe(before[0]!.id);
      expect(edited.title).toBe("更新後タイトル");
      expect(edited.dueDate).toBe("2026-09-01");
      expect(edited.priority).toBe("low");
      expect(edited.tags).toEqual(["仕事", "重要"]);
      expect(edited.createdAt).toBe(before[0]!.createdAt);
    });

    it("updatedAtを更新し、createdAtは変えない", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const before = [makeTodo()];
      vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));

      const after = applyTodoCommand(before, {
        type: "edit",
        id: before[0]!.id,
        title: "更新",
        priority: "medium",
        tags: [],
      });

      expect(after[0]!.createdAt).toBe(before[0]!.createdAt);
      expect(after[0]!.updatedAt).toBe("2026-06-01T12:00:00.000Z");
      expect(after[0]!.updatedAt).not.toBe(after[0]!.createdAt);
      vi.useRealTimers();
    });

    it("他のTodoには影響しない", () => {
      const other = makeTodo({
        id: "6f2a9a2e-5b8c-4b2b-9f9a-4a2b2c1e0002",
        title: "他のタスク",
      });
      const target = makeTodo();
      const after = applyTodoCommand([other, target], {
        type: "edit",
        id: target.id,
        title: "変更後",
        priority: "medium",
        tags: [],
      });
      expect(after[0]).toEqual(other);
      expect(after[1]!.title).toBe("変更後");
    });

    it("存在しないidの場合はTODO_NOT_FOUNDを投げる", () => {
      try {
        applyTodoCommand([], {
          type: "edit",
          id: "6f2a9a2e-5b8c-4b2b-9f9a-4a2b2c1e9999",
          title: "存在しない",
          priority: "medium",
          tags: [],
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TodoCrudError);
        expect((e as TodoCrudError).code).toBe("TODO_NOT_FOUND");
      }
    });

    it("titleが空白のみの場合はEMPTY_TITLEを投げる（idが存在していても）", () => {
      const before = [makeTodo()];
      try {
        applyTodoCommand(before, {
          type: "edit",
          id: before[0]!.id,
          title: "   ",
          priority: "medium",
          tags: [],
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TodoCrudError);
        expect((e as TodoCrudError).code).toBe("EMPTY_TITLE");
      }
    });
  });

  describe("toggle_complete", () => {
    it("completedを反転させる", () => {
      const before = [makeTodo({ completed: false })];
      const after = applyTodoCommand(before, {
        type: "toggle_complete",
        id: before[0]!.id,
      });
      expect(after[0]!.completed).toBe(true);

      const after2 = applyTodoCommand(after, {
        type: "toggle_complete",
        id: after[0]!.id,
      });
      expect(after2[0]!.completed).toBe(false);
    });

    it("updatedAtを更新する", () => {
      const before = [makeTodo({ updatedAt: "2020-01-01T00:00:00.000Z" })];
      const after = applyTodoCommand(before, {
        type: "toggle_complete",
        id: before[0]!.id,
      });
      expect(after[0]!.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
    });

    it("存在しないidの場合はTODO_NOT_FOUNDを投げる", () => {
      try {
        applyTodoCommand([], {
          type: "toggle_complete",
          id: "6f2a9a2e-5b8c-4b2b-9f9a-4a2b2c1e9999",
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TodoCrudError);
        expect((e as TodoCrudError).code).toBe("TODO_NOT_FOUND");
      }
    });
  });

  describe("delete", () => {
    it("該当のTodoを配列から取り除く", () => {
      const target = makeTodo();
      const other = makeTodo({
        id: "6f2a9a2e-5b8c-4b2b-9f9a-4a2b2c1e0002",
      });
      const after = applyTodoCommand([target, other], {
        type: "delete",
        id: target.id,
      });
      expect(after).toEqual([other]);
    });

    it("存在しないidの場合はTODO_NOT_FOUNDを投げる", () => {
      try {
        applyTodoCommand([], {
          type: "delete",
          id: "6f2a9a2e-5b8c-4b2b-9f9a-4a2b2c1e9999",
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TodoCrudError);
        expect((e as TodoCrudError).code).toBe("TODO_NOT_FOUND");
      }
    });
  });

  describe("複数コマンドの連続適用", () => {
    it("add -> edit -> toggle_complete -> delete を順に適用できる", () => {
      let state: TodoItem[] = [];

      state = applyTodoCommand(state, {
        type: "add",
        title: "レポート作成",
        priority: "medium",
        tags: [],
      });
      expect(state).toHaveLength(1);
      const id = state[0]!.id;
      const createdAt = state[0]!.createdAt;

      state = applyTodoCommand(state, {
        type: "edit",
        id,
        title: "レポート作成（修正版）",
        priority: "high",
        tags: ["仕事"],
      });
      expect(state[0]!.title).toBe("レポート作成（修正版）");
      expect(state[0]!.createdAt).toBe(createdAt);

      state = applyTodoCommand(state, { type: "toggle_complete", id });
      expect(state[0]!.completed).toBe(true);

      state = applyTodoCommand(state, { type: "delete", id });
      expect(state).toHaveLength(0);
    });
  });
});

describe("TodoCrudError", () => {
  it("toResponse() が contract.yaml の response_shape に一致する", () => {
    try {
      applyTodoCommand([], { type: "add", title: "", priority: "medium", tags: [] });
      expect.unreachable();
    } catch (e) {
      const err = e as TodoCrudError;
      const response = err.toResponse();
      expect(response).toEqual({ code: "EMPTY_TITLE", message: expect.any(String) });
    }
  });
});
