/**
 * contract.yaml の inputs["display_todo_list"] の要素 / outputs["edit_requested_todo"]
 * と同一の形。01-foundation/shared-kernel.yaml の TodoItem に対応する。
 */
export type Priority = "high" | "medium" | "low";

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
  priority: Priority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * contract.yaml の outputs["todo_command"] と同一の形。todo-crud が消費するコマンド。
 */
export type TodoCommand =
  | { type: "toggle_complete"; id: string }
  | { type: "delete"; id: string };

/**
 * 一覧表示から発行されるコールバック群。
 * - onCommand: チェック操作 / 削除操作から生成される todo_command を渡す
 * - onEditRequested: 編集操作が選択されたタスクの TodoItem 全体を渡す（edit_requested_todo）
 */
export interface TodoListViewCallbacks {
  onCommand: (command: TodoCommand) => void;
  onEditRequested: (todo: TodoItem) => void;
}
