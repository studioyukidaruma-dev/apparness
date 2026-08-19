import type { TodoItem } from "./types";
import { TodoStorageError } from "./errors";

/** localStorage 上でこの機能が使用するキー。実装詳細としてこの機能に閉じる。 */
export const STORAGE_KEY = "apparness.todo-app.todos.v1";

/**
 * window.localStorage への参照を取得する。
 * アクセス自体が例外を投げる環境（無効化・プライベートブラウジング制約等）では
 * STORAGE_UNAVAILABLE として報告する。
 */
function getStorage(): Storage {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      throw new Error("localStorage is not available in this environment");
    }
    return window.localStorage;
  } catch (cause) {
    throw new TodoStorageError(
      "STORAGE_UNAVAILABLE",
      "localStorage を利用できません（無効化されているか、プライベートブラウジング等の制約があります）。",
      { cause },
    );
  }
}

function isValidTodoItem(value: unknown): value is TodoItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.completed === "boolean" &&
    (v.dueDate === null || typeof v.dueDate === "string") &&
    (v.priority === "high" || v.priority === "medium" || v.priority === "low") &&
    Array.isArray(v.tags) &&
    (v.tags as unknown[]).every((t) => typeof t === "string") &&
    typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string"
  );
}

function isValidTodoList(value: unknown): value is TodoItem[] {
  return Array.isArray(value) && value.every(isValidTodoItem);
}

export interface LoadTodoListResult {
  /** contract.yaml の outputs.persisted_todo_list。保存データが無い/破損している場合は空配列。 */
  todoList: TodoItem[];
  /**
   * STORAGE_DATA_CORRUPTED が発生した場合のみセットされる。
   * このエラーは呼び出し側の処理を止めない（todoList は常に利用可能な空配列にフォールバック済み）。
   * STORAGE_UNAVAILABLE は復旧不能なため例外として投げる（error には現れない）。
   */
  error: TodoStorageError | null;
}

/**
 * アプリ起動時などに localStorage から TodoItem 配列を読み込む（persisted_todo_list を得る）。
 *
 * - 保存データが存在しない場合は `{ todoList: [], error: null }` を返す。
 * - 保存データの JSON パースに失敗した、またはスキーマに一致しない場合は
 *   利用不能として扱わず `{ todoList: [], error: TodoStorageError(STORAGE_DATA_CORRUPTED) }` を返す。
 * - localStorage 自体にアクセスできない場合は `TodoStorageError(STORAGE_UNAVAILABLE)` を投げる。
 */
export function loadTodoList(): LoadTodoListResult {
  const storage = getStorage();

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (cause) {
    throw new TodoStorageError(
      "STORAGE_UNAVAILABLE",
      "localStorage からの読み込みに失敗しました。",
      { cause },
    );
  }

  if (raw === null) {
    return { todoList: [], error: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    return {
      todoList: [],
      error: new TodoStorageError(
        "STORAGE_DATA_CORRUPTED",
        "保存済みの TODO データの JSON パースに失敗しました。",
        { cause },
      ),
    };
  }

  if (!isValidTodoList(parsed)) {
    return {
      todoList: [],
      error: new TodoStorageError(
        "STORAGE_DATA_CORRUPTED",
        "保存済みの TODO データのスキーマが不正です。",
      ),
    };
  }

  return { todoList: parsed, error: null };
}

/**
 * todo-crud から渡された TodoItem 配列全体（todo_list_to_persist）で localStorage を上書き保存する
 * （差分更新ではなく配列全体の置き換え）。
 *
 * - localStorage にアクセス・書き込みできない場合は `TodoStorageError(STORAGE_UNAVAILABLE)` を投げる。
 * - ストレージ容量の上限を超えた場合は `TodoStorageError(STORAGE_QUOTA_EXCEEDED)` を投げる。
 */
export function saveTodoList(todoList: TodoItem[]): void {
  const storage = getStorage();

  const serialized = JSON.stringify(todoList);

  try {
    storage.setItem(STORAGE_KEY, serialized);
  } catch (cause) {
    if (isQuotaExceededError(cause)) {
      throw new TodoStorageError(
        "STORAGE_QUOTA_EXCEEDED",
        "保存先のストレージ容量が上限を超えました。",
        { cause },
      );
    }
    throw new TodoStorageError(
      "STORAGE_UNAVAILABLE",
      "localStorage への書き込みに失敗しました。",
      { cause },
    );
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false;
  }
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}
