import type { TodoItem } from "./types.js";

/**
 * 期限超過（FR-6）かどうかを判定する。
 * completed なタスクは期限超過扱いにしない（完了済みタスクを警告表示しないため）。
 * dueDate は "YYYY-MM-DD" 形式。当日はまだ超過していない扱いとする。
 *
 * @param todo 判定対象の TodoItem
 * @param now 「現在時刻」として扱う Date（省略時は実時刻）。テストで固定するために注入可能にしている。
 */
export function isOverdue(todo: Pick<TodoItem, "dueDate" | "completed">, now: Date = new Date()): boolean {
  if (todo.completed || !todo.dueDate) {
    return false;
  }

  const today = toDateOnlyString(now);
  return todo.dueDate < today;
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
