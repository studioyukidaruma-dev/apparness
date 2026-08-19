import { isOverdue } from "./overdue.js";
import type { Priority, TodoCommand, TodoItem, TodoListViewCallbacks } from "./types.js";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export interface RenderTodoListViewOptions {
  /** テストで「現在時刻」を固定するための注入。省略時は実時刻。 */
  now?: Date;
}

/**
 * 渡された TodoItem 配列（絞り込み・並び替え済み）を container の中に一覧描画する。
 * この関数自身は絞り込み・並び替えを一切行わず、渡された順序のまま描画する。
 *
 * チェック操作 / 削除操作は callbacks.onCommand に TodoCommand を渡して通知し、
 * 編集操作は callbacks.onEditRequested に対象の TodoItem 全体を渡して通知する。
 * どちらも「発行するだけ」で、実際のデータ変更は行わない（side_effects なし）。
 */
export function renderTodoListView(
  container: HTMLElement,
  todos: readonly TodoItem[],
  callbacks: TodoListViewCallbacks,
  options: RenderTodoListViewOptions = {},
): void {
  const now = options.now ?? new Date();
  const doc = container.ownerDocument;

  container.textContent = "";
  container.classList.add("todo-list-view");

  if (todos.length === 0) {
    const empty = doc.createElement("p");
    empty.className = "todo-list-view__empty";
    empty.textContent = "タスクがありません";
    container.appendChild(empty);
    return;
  }

  const list = doc.createElement("ul");
  list.className = "todo-list";
  list.setAttribute("role", "list");

  for (const todo of todos) {
    list.appendChild(renderTodoItem(doc, todo, callbacks, now));
  }

  container.appendChild(list);
}

function renderTodoItem(
  doc: Document,
  todo: TodoItem,
  callbacks: TodoListViewCallbacks,
  now: Date,
): HTMLLIElement {
  const overdue = isOverdue(todo, now);

  const item = doc.createElement("li");
  item.className = buildItemClassName(todo, overdue);
  item.dataset.testid = "todo-item";
  item.dataset.id = todo.id;
  if (overdue) {
    item.dataset.overdue = "true";
  }
  item.dataset.priority = todo.priority;

  const checkbox = doc.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "todo-item__checkbox";
  checkbox.checked = todo.completed;
  checkbox.setAttribute("aria-label", `${todo.title} を完了にする`);
  checkbox.addEventListener("change", () => {
    emitCommand(callbacks, { type: "toggle_complete", id: todo.id });
  });
  item.appendChild(checkbox);

  const title = doc.createElement("span");
  title.className = "todo-item__title";
  title.textContent = todo.title;
  item.appendChild(title);

  const priorityBadge = doc.createElement("span");
  priorityBadge.className = `todo-item__priority todo-item__priority--${todo.priority}`;
  priorityBadge.textContent = PRIORITY_LABEL[todo.priority];
  priorityBadge.setAttribute("aria-label", `優先度: ${PRIORITY_LABEL[todo.priority]}`);
  item.appendChild(priorityBadge);

  if (todo.dueDate) {
    const dueDate = doc.createElement("span");
    dueDate.className = overdue
      ? "todo-item__due-date todo-item__due-date--overdue"
      : "todo-item__due-date";
    dueDate.textContent = todo.dueDate;
    if (overdue) {
      dueDate.setAttribute("aria-label", `期限超過: ${todo.dueDate}`);
    }
    item.appendChild(dueDate);
  }

  if (todo.tags.length > 0) {
    const tagList = doc.createElement("ul");
    tagList.className = "todo-item__tags";
    for (const tag of todo.tags) {
      const tagItem = doc.createElement("li");
      tagItem.className = "todo-item__tag";
      tagItem.textContent = tag;
      tagList.appendChild(tagItem);
    }
    item.appendChild(tagList);
  }

  const editButton = doc.createElement("button");
  editButton.type = "button";
  editButton.className = "todo-item__edit-button";
  editButton.textContent = "編集";
  editButton.addEventListener("click", () => {
    callbacks.onEditRequested(todo);
  });
  item.appendChild(editButton);

  const deleteButton = doc.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "todo-item__delete-button";
  deleteButton.textContent = "削除";
  deleteButton.addEventListener("click", () => {
    emitCommand(callbacks, { type: "delete", id: todo.id });
  });
  item.appendChild(deleteButton);

  return item;
}

function buildItemClassName(todo: TodoItem, overdue: boolean): string {
  const classes = ["todo-item", `todo-item--priority-${todo.priority}`];
  if (todo.completed) {
    classes.push("todo-item--completed");
  }
  if (overdue) {
    classes.push("todo-item--overdue");
  }
  return classes.join(" ");
}

function emitCommand(callbacks: TodoListViewCallbacks, command: TodoCommand): void {
  callbacks.onCommand(command);
}
