/**
 * Todo ドメインの型定義。
 *
 * `TodoItem` は shared-kernel.yaml（apps/todo-app/01-foundation/shared-kernel.yaml）の
 * common_types.TodoItem に対応する。他機能（todo-storage / todo-form / todo-list-view /
 * todo-filter-sort）とやり取りする配列要素の形はここで一意に定義する。
 */

/** 優先度。未指定時のデフォルトは "medium"（呼び出し側で決定する）。 */
export type Priority = "high" | "medium" | "low";

/** 1件のTodo。 */
export interface TodoItem {
  /** crypto.randomUUID() 等で発行する一意な識別子 */
  id: string;
  /** 1〜200文字 */
  title: string;
  completed: boolean;
  /** YYYY-MM-DD。未設定は null */
  dueDate: string | null;
  priority: Priority;
  /** 自由入力のカテゴリ/タグ。0件以上 */
  tags: string[];
  /** ISO 8601 日時文字列 */
  createdAt: string;
  /** ISO 8601 日時文字列 */
  updatedAt: string;
}

/** todo-form から渡される新規追加コマンド。 */
export interface AddTodoCommand {
  type: "add";
  title: string;
  dueDate?: string | null;
  priority: Priority;
  tags: string[];
}

/** todo-form から渡される編集コマンド。 */
export interface EditTodoCommand {
  type: "edit";
  id: string;
  title: string;
  dueDate?: string | null;
  priority: Priority;
  tags: string[];
}

/** todo-list-view から渡される完了切替コマンド。 */
export interface ToggleCompleteTodoCommand {
  type: "toggle_complete";
  id: string;
}

/** todo-list-view から渡される削除コマンド。 */
export interface DeleteTodoCommand {
  type: "delete";
  id: string;
}

/** この機能が受け付ける全コマンドの直和型。 */
export type TodoCommand =
  | AddTodoCommand
  | EditTodoCommand
  | ToggleCompleteTodoCommand
  | DeleteTodoCommand;

/** contract.yaml の error_cases に対応するエラーコード。 */
export type TodoCrudErrorCode = "EMPTY_TITLE" | "TODO_NOT_FOUND";
