import { describe, expect, it } from "vitest";
import { filterAndSortTodos } from "../src/filterSort.js";
import type { TodoItem } from "../src/types.js";

function makeTodo(overrides: Partial<TodoItem> & Pick<TodoItem, "id">): TodoItem {
  return {
    id: overrides.id,
    title: overrides.title ?? `title-${overrides.id}`,
    completed: overrides.completed ?? false,
    dueDate: overrides.dueDate ?? null,
    priority: overrides.priority ?? "medium",
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("filterAndSortTodos", () => {
  describe("criteria 未指定時", () => {
    it("全件・入力順のまま出力する", () => {
      const list: TodoItem[] = [
        makeTodo({ id: "1", completed: true }),
        makeTodo({ id: "2", completed: false }),
        makeTodo({ id: "3", completed: true }),
      ];

      const result = filterAndSortTodos(list);

      expect(result.map((t) => t.id)).toEqual(["1", "2", "3"]);
    });

    it("空オブジェクトを渡した場合も全件・入力順になる", () => {
      const list: TodoItem[] = [
        makeTodo({ id: "1" }),
        makeTodo({ id: "2" }),
      ];

      const result = filterAndSortTodos(list, {});

      expect(result.map((t) => t.id)).toEqual(["1", "2"]);
    });

    it("入力配列を変更しない（非破壊）", () => {
      const list: TodoItem[] = [
        makeTodo({ id: "1", priority: "low" }),
        makeTodo({ id: "2", priority: "high" }),
      ];
      const originalOrder = list.map((t) => t.id);

      filterAndSortTodos(list, { sortBy: "priority", sortOrder: "asc" });

      expect(list.map((t) => t.id)).toEqual(originalOrder);
    });
  });

  describe("completedFilter", () => {
    const list: TodoItem[] = [
      makeTodo({ id: "1", completed: true }),
      makeTodo({ id: "2", completed: false }),
      makeTodo({ id: "3", completed: true }),
      makeTodo({ id: "4", completed: false }),
    ];

    it("'all' は全件を返す", () => {
      const result = filterAndSortTodos(list, { completedFilter: "all" });
      expect(result.map((t) => t.id)).toEqual(["1", "2", "3", "4"]);
    });

    it("'completed' は完了済みのみ返す", () => {
      const result = filterAndSortTodos(list, { completedFilter: "completed" });
      expect(result.map((t) => t.id)).toEqual(["1", "3"]);
    });

    it("'incomplete' は未完了のみ返す", () => {
      const result = filterAndSortTodos(list, { completedFilter: "incomplete" });
      expect(result.map((t) => t.id)).toEqual(["2", "4"]);
    });
  });

  describe("sortBy: dueDate", () => {
    const list: TodoItem[] = [
      makeTodo({ id: "a", dueDate: "2026-03-01" }),
      makeTodo({ id: "b", dueDate: "2026-01-01" }),
      makeTodo({ id: "c", dueDate: null }),
      makeTodo({ id: "d", dueDate: "2026-02-01" }),
    ];

    it("asc: 期限が早い順、期限なしは末尾", () => {
      const result = filterAndSortTodos(list, { sortBy: "dueDate", sortOrder: "asc" });
      expect(result.map((t) => t.id)).toEqual(["b", "d", "a", "c"]);
    });

    it("desc: 期限が遅い順、期限なしは末尾", () => {
      const result = filterAndSortTodos(list, { sortBy: "dueDate", sortOrder: "desc" });
      expect(result.map((t) => t.id)).toEqual(["a", "d", "b", "c"]);
    });

    it("sortOrder 未指定時は asc として扱う", () => {
      const result = filterAndSortTodos(list, { sortBy: "dueDate" });
      expect(result.map((t) => t.id)).toEqual(["b", "d", "a", "c"]);
    });
  });

  describe("sortBy: priority", () => {
    const list: TodoItem[] = [
      makeTodo({ id: "a", priority: "low" }),
      makeTodo({ id: "b", priority: "high" }),
      makeTodo({ id: "c", priority: "medium" }),
      makeTodo({ id: "d", priority: "high" }),
    ];

    it("asc: high -> medium -> low の順（同順位は入力順を維持）", () => {
      const result = filterAndSortTodos(list, { sortBy: "priority", sortOrder: "asc" });
      expect(result.map((t) => t.id)).toEqual(["b", "d", "c", "a"]);
    });

    it("desc: low -> medium -> high の順（同順位は入力順を維持）", () => {
      const result = filterAndSortTodos(list, { sortBy: "priority", sortOrder: "desc" });
      expect(result.map((t) => t.id)).toEqual(["a", "c", "b", "d"]);
    });
  });

  describe("sortBy: none", () => {
    it("並び替えを行わず、フィルタ後の入力順を維持する", () => {
      const list: TodoItem[] = [
        makeTodo({ id: "1", completed: false, priority: "low", dueDate: "2026-05-01" }),
        makeTodo({ id: "2", completed: true, priority: "high", dueDate: "2026-01-01" }),
        makeTodo({ id: "3", completed: false, priority: "medium", dueDate: "2026-03-01" }),
      ];

      const result = filterAndSortTodos(list, {
        completedFilter: "incomplete",
        sortBy: "none",
        sortOrder: "desc",
      });

      expect(result.map((t) => t.id)).toEqual(["1", "3"]);
    });
  });

  describe("フィルタとソートの組み合わせ", () => {
    it("未完了のみを期限昇順で並び替える", () => {
      const list: TodoItem[] = [
        makeTodo({ id: "1", completed: true, dueDate: "2026-01-01" }),
        makeTodo({ id: "2", completed: false, dueDate: "2026-05-01" }),
        makeTodo({ id: "3", completed: false, dueDate: "2026-02-01" }),
        makeTodo({ id: "4", completed: true, dueDate: "2026-01-15" }),
      ];

      const result = filterAndSortTodos(list, {
        completedFilter: "incomplete",
        sortBy: "dueDate",
        sortOrder: "asc",
      });

      expect(result.map((t) => t.id)).toEqual(["3", "2"]);
    });
  });
});
