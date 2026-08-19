import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTodoList, saveTodoList, STORAGE_KEY, TodoStorageError, type TodoItem } from "../src/index";

/**
 * jsdom の localStorage は内部的に Proxy で実装されており、vi.spyOn によるメソッド差し替えが
 * 期待通りに効かない。そのため window.localStorage 自体を偽オブジェクトに差し替えて検証する。
 */
function withFakeLocalStorage<T>(fake: Partial<Storage>, fn: () => T): T {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: fake as Storage,
  });
  try {
    return fn();
  } finally {
    if (original) {
      Object.defineProperty(window, "localStorage", original);
    }
  }
}

function makeTodoItem(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "6f2a9a2e-5b8c-4b2b-9f9a-4a2b2c1e0001",
    title: "牛乳を買う",
    completed: false,
    dueDate: "2026-08-20",
    priority: "medium",
    tags: ["買い物"],
    createdAt: "2026-08-19T09:00:00Z",
    updatedAt: "2026-08-19T09:00:00Z",
    ...overrides,
  };
}

describe("todo-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("空データ時の初期化", () => {
    it("保存データが存在しない場合、空配列を返す", () => {
      const result = loadTodoList();
      expect(result).toEqual({ todoList: [], error: null });
    });
  });

  describe("保存→読み込みの往復一致", () => {
    it("saveTodoList で保存した内容が loadTodoList でそのまま読み込める", () => {
      const todoList: TodoItem[] = [
        makeTodoItem(),
        makeTodoItem({
          id: "6f2a9a2e-5b8c-4b2b-9f9a-4a2b2c1e0002",
          title: "牛乳以外も買う",
          completed: true,
          dueDate: null,
          priority: "low",
          tags: [],
        }),
      ];

      saveTodoList(todoList);
      const result = loadTodoList();

      expect(result.error).toBeNull();
      expect(result.todoList).toEqual(todoList);
    });

    it("空配列も往復一致する", () => {
      saveTodoList([]);
      const result = loadTodoList();
      expect(result).toEqual({ todoList: [], error: null });
    });

    it("localStorage に格納される値は JSON 文字列である", () => {
      const todoList = [makeTodoItem()];
      saveTodoList(todoList);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw as string)).toEqual(todoList);
    });

    it("保存のたびに配列全体が上書きされる（差分更新ではない）", () => {
      saveTodoList([makeTodoItem()]);
      const second = [makeTodoItem({ title: "更新後" })];
      saveTodoList(second);

      const result = loadTodoList();
      expect(result.todoList).toEqual(second);
    });
  });

  describe("STORAGE_DATA_CORRUPTED", () => {
    it("不正な JSON 文字列が格納されている場合、空配列にフォールバックしエラーを報告する", () => {
      window.localStorage.setItem(STORAGE_KEY, "{ this is not valid json");

      const result = loadTodoList();

      expect(result.todoList).toEqual([]);
      expect(result.error).toBeInstanceOf(TodoStorageError);
      expect(result.error?.code).toBe("STORAGE_DATA_CORRUPTED");
    });

    it("スキーマに一致しないデータが格納されている場合も破損として扱う", () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));

      const result = loadTodoList();

      expect(result.todoList).toEqual([]);
      expect(result.error?.code).toBe("STORAGE_DATA_CORRUPTED");
    });

    it("配列内の要素が TodoItem のスキーマを満たさない場合も破損として扱う", () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ id: "1", title: "欠損データ" }]),
      );

      const result = loadTodoList();

      expect(result.todoList).toEqual([]);
      expect(result.error?.code).toBe("STORAGE_DATA_CORRUPTED");
    });
  });

  describe("STORAGE_UNAVAILABLE", () => {
    it("localStorage へのアクセスが例外を投げる場合、loadTodoList は STORAGE_UNAVAILABLE を投げる", () => {
      const original = Object.getOwnPropertyDescriptor(window, "localStorage");
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get(): Storage {
          throw new Error("SecurityError: localStorage access denied");
        },
      });

      try {
        let thrown: unknown;
        try {
          loadTodoList();
        } catch (e) {
          thrown = e;
        }
        expect(thrown).toBeInstanceOf(TodoStorageError);
        expect((thrown as TodoStorageError).code).toBe("STORAGE_UNAVAILABLE");
      } finally {
        if (original) {
          Object.defineProperty(window, "localStorage", original);
        }
      }
    });

    it("localStorage へのアクセスが例外を投げる場合、saveTodoList も STORAGE_UNAVAILABLE を投げる", () => {
      const original = Object.getOwnPropertyDescriptor(window, "localStorage");
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get(): Storage {
          throw new Error("SecurityError: localStorage access denied");
        },
      });

      try {
        let thrown: unknown;
        try {
          saveTodoList([makeTodoItem()]);
        } catch (e) {
          thrown = e;
        }
        expect(thrown).toBeInstanceOf(TodoStorageError);
        expect((thrown as TodoStorageError).code).toBe("STORAGE_UNAVAILABLE");
      } finally {
        if (original) {
          Object.defineProperty(window, "localStorage", original);
        }
      }
    });

    it("getItem 自体が例外を投げる場合も STORAGE_UNAVAILABLE として報告する", () => {
      const fake: Partial<Storage> = {
        getItem: () => {
          throw new Error("boom");
        },
      };

      const thrown = withFakeLocalStorage(fake, () => {
        try {
          loadTodoList();
          return null;
        } catch (e) {
          return e;
        }
      });

      expect(thrown).toBeInstanceOf(TodoStorageError);
      expect((thrown as TodoStorageError).code).toBe("STORAGE_UNAVAILABLE");
    });
  });

  describe("STORAGE_QUOTA_EXCEEDED", () => {
    it("setItem が QuotaExceededError を投げる場合、STORAGE_QUOTA_EXCEEDED を投げる", () => {
      const quotaError = new DOMException("Quota exceeded", "QuotaExceededError");
      const fake: Partial<Storage> = {
        setItem: () => {
          throw quotaError;
        },
      };

      const thrown = withFakeLocalStorage(fake, () => {
        try {
          saveTodoList([makeTodoItem()]);
          return null;
        } catch (e) {
          return e;
        }
      });

      expect(thrown).toBeInstanceOf(TodoStorageError);
      expect((thrown as TodoStorageError).code).toBe("STORAGE_QUOTA_EXCEEDED");
    });

    it("setItem がコード 22 の DOMException を投げる場合も STORAGE_QUOTA_EXCEEDED を投げる（旧ブラウザ互換）", () => {
      const quotaError = new DOMException("Quota exceeded", "OldQuotaExceededError");
      Object.defineProperty(quotaError, "code", { value: 22 });
      const fake: Partial<Storage> = {
        setItem: () => {
          throw quotaError;
        },
      };

      const thrown = withFakeLocalStorage(fake, () => {
        try {
          saveTodoList([makeTodoItem()]);
          return null;
        } catch (e) {
          return e;
        }
      });

      expect(thrown).toBeInstanceOf(TodoStorageError);
      expect((thrown as TodoStorageError).code).toBe("STORAGE_QUOTA_EXCEEDED");
    });
  });
});
