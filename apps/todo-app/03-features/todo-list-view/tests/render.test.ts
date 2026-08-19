import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderTodoListView } from "../src/render.js";
import type { TodoCommand, TodoItem } from "../src/types.js";

const FIXED_NOW = new Date("2026-08-19T12:00:00Z");

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "6f2a9a2e-5b8c-4b2b-9f9a-4a2b2c1e0001",
    title: "牛乳を買う",
    completed: false,
    dueDate: null,
    priority: "medium",
    tags: [],
    createdAt: "2026-08-19T09:00:00Z",
    updatedAt: "2026-08-19T09:00:00Z",
    ...overrides,
  };
}

describe("renderTodoListView", () => {
  let container: HTMLElement;
  let onCommand: ReturnType<typeof vi.fn<(command: TodoCommand) => void>>;
  let onEditRequested: ReturnType<typeof vi.fn<(todo: TodoItem) => void>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    onCommand = vi.fn();
    onEditRequested = vi.fn();
  });

  it("空配列のときは空状態メッセージを表示する", () => {
    renderTodoListView(container, [], { onCommand, onEditRequested });

    expect(container.querySelector(".todo-list")).toBeNull();
    expect(container.textContent).toContain("タスクがありません");
  });

  it("渡された TodoItem 配列をそのままの順序で一覧描画する", () => {
    const todos = [
      makeTodo({ id: "id-1", title: "1件目" }),
      makeTodo({ id: "id-2", title: "2件目" }),
      makeTodo({ id: "id-3", title: "3件目" }),
    ];

    renderTodoListView(container, todos, { onCommand, onEditRequested }, { now: FIXED_NOW });

    const items = container.querySelectorAll('[data-testid="todo-item"]');
    expect(items).toHaveLength(3);
    expect(items[0].getAttribute("data-id")).toBe("id-1");
    expect(items[1].getAttribute("data-id")).toBe("id-2");
    expect(items[2].getAttribute("data-id")).toBe("id-3");
    expect(items[0].textContent).toContain("1件目");
    expect(items[1].textContent).toContain("2件目");
    expect(items[2].textContent).toContain("3件目");
  });

  it("タイトル・優先度・タグを表示する", () => {
    const todo = makeTodo({
      title: "牛乳を買う",
      priority: "high",
      tags: ["買い物", "急ぎ"],
    });

    renderTodoListView(container, [todo], { onCommand, onEditRequested }, { now: FIXED_NOW });

    const item = container.querySelector('[data-testid="todo-item"]') as HTMLElement;
    expect(item.textContent).toContain("牛乳を買う");
    expect(item.querySelector(".todo-item__priority")?.textContent).toBe("高");
    const tagTexts = Array.from(item.querySelectorAll(".todo-item__tag")).map((el) => el.textContent);
    expect(tagTexts).toEqual(["買い物", "急ぎ"]);
  });

  it("チェック操作で toggle_complete コマンドを発行する", () => {
    const todo = makeTodo({ id: "id-toggle" });
    renderTodoListView(container, [todo], { onCommand, onEditRequested }, { now: FIXED_NOW });

    const checkbox = container.querySelector<HTMLInputElement>(".todo-item__checkbox")!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith({ type: "toggle_complete", id: "id-toggle" });
  });

  it("削除操作で delete コマンドを発行する", () => {
    const todo = makeTodo({ id: "id-delete" });
    renderTodoListView(container, [todo], { onCommand, onEditRequested }, { now: FIXED_NOW });

    const deleteButton = container.querySelector<HTMLButtonElement>(".todo-item__delete-button")!;
    deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith({ type: "delete", id: "id-delete" });
  });

  it("編集操作で対象タスクの TodoItem 全体を edit_requested として発行する", () => {
    const todo = makeTodo({ id: "id-edit", title: "編集対象" });
    renderTodoListView(container, [todo], { onCommand, onEditRequested }, { now: FIXED_NOW });

    const editButton = container.querySelector<HTMLButtonElement>(".todo-item__edit-button")!;
    editButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onEditRequested).toHaveBeenCalledTimes(1);
    expect(onEditRequested).toHaveBeenCalledWith(todo);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("期限超過かつ未完了のタスクは視覚的に区別されるクラス/属性を持つ", () => {
    const overdueTodo = makeTodo({ id: "id-overdue", dueDate: "2026-08-01", completed: false });
    const futureTodo = makeTodo({ id: "id-future", dueDate: "2026-12-01", completed: false });

    renderTodoListView(
      container,
      [overdueTodo, futureTodo],
      { onCommand, onEditRequested },
      { now: FIXED_NOW },
    );

    const overdueEl = container.querySelector('[data-id="id-overdue"]')!;
    const futureEl = container.querySelector('[data-id="id-future"]')!;

    expect(overdueEl.className).toContain("todo-item--overdue");
    expect(overdueEl.getAttribute("data-overdue")).toBe("true");
    expect(futureEl.className).not.toContain("todo-item--overdue");
    expect(futureEl.hasAttribute("data-overdue")).toBe(false);
  });

  it("期限超過でも完了済みのタスクは overdue 扱いにしない", () => {
    const completedOverdueTodo = makeTodo({
      id: "id-completed-overdue",
      dueDate: "2026-08-01",
      completed: true,
    });

    renderTodoListView(
      container,
      [completedOverdueTodo],
      { onCommand, onEditRequested },
      { now: FIXED_NOW },
    );

    const el = container.querySelector('[data-id="id-completed-overdue"]')!;
    expect(el.className).not.toContain("todo-item--overdue");
    expect(el.className).toContain("todo-item--completed");
  });

  it("優先度ごとに区別可能なクラスを持つ", () => {
    const todos = [
      makeTodo({ id: "id-high", priority: "high" }),
      makeTodo({ id: "id-medium", priority: "medium" }),
      makeTodo({ id: "id-low", priority: "low" }),
    ];

    renderTodoListView(container, todos, { onCommand, onEditRequested }, { now: FIXED_NOW });

    expect(container.querySelector('[data-id="id-high"]')?.className).toContain(
      "todo-item--priority-high",
    );
    expect(container.querySelector('[data-id="id-medium"]')?.className).toContain(
      "todo-item--priority-medium",
    );
    expect(container.querySelector('[data-id="id-low"]')?.className).toContain(
      "todo-item--priority-low",
    );
  });

  it("再描画時に前回の内容をクリアする", () => {
    renderTodoListView(
      container,
      [makeTodo({ id: "id-1" })],
      { onCommand, onEditRequested },
      { now: FIXED_NOW },
    );
    expect(container.querySelectorAll('[data-testid="todo-item"]')).toHaveLength(1);

    renderTodoListView(
      container,
      [makeTodo({ id: "id-2" }), makeTodo({ id: "id-3" })],
      { onCommand, onEditRequested },
      { now: FIXED_NOW },
    );

    const items = container.querySelectorAll('[data-testid="todo-item"]');
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute("data-id")).toBe("id-2");
  });
});
