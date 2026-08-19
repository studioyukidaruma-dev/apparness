import type { AddTodoCommand, EditTodoCommand, FormError, Priority, TodoCommand, TodoItem } from "./types.js";

export interface RawFormValues {
  title: string;
  dueDate: string;
  priority: Priority;
  tagsText: string;
}

/** 空文字列/undefined/null を安全に trim する */
function safeTrim(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * タグ入力欄の生テキスト（カンマ区切り）を tags 配列に変換する。
 * 前後の空白を除去し、空要素・重複要素を取り除く。
 */
export function parseTags(tagsText: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of tagsText.split(",")) {
    const tag = raw.trim();
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/** tags 配列を入力欄用のカンマ区切りテキストに戻す（編集時のプリフィル用） */
export function stringifyTags(tags: string[]): string {
  return tags.join(", ");
}

/**
 * タイトルの送信前バリデーション。
 * contract.yaml error_cases[0] TITLE_REQUIRED に対応。
 */
export function validateTitle(title: string): FormError | null {
  if (safeTrim(title).length === 0) {
    return { code: "TITLE_REQUIRED", message: "タイトルを入力してください。" };
  }
  return null;
}

/** 日付入力欄の値（空文字は未設定）を dueDate 用の値へ変換する */
function normalizeDueDate(dueDate: string): string | null {
  const trimmed = safeTrim(dueDate);
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * フォームの生入力値から todo_command を生成する。
 * editTargetId が指定されていれば edit コマンド、なければ add コマンドを返す。
 * タイトルが空の場合は TITLE_REQUIRED エラーを返す（コマンドは生成しない）。
 */
export function buildTodoCommand(
  values: RawFormValues,
  editTargetId: string | null,
): { command: TodoCommand } | { error: FormError } {
  const error = validateTitle(values.title);
  if (error) return { error };

  const title = safeTrim(values.title);
  const dueDate = normalizeDueDate(values.dueDate);
  const tags = parseTags(values.tagsText);

  if (editTargetId !== null) {
    const command: EditTodoCommand = {
      type: "edit",
      id: editTargetId,
      title,
      dueDate,
      priority: values.priority,
      tags,
    };
    return { command };
  }

  const command: AddTodoCommand = {
    type: "add",
    title,
    dueDate,
    priority: values.priority,
    tags,
  };
  return { command };
}

/** edit_target_todo から RawFormValues へのプリフィル用変換 */
export function toRawFormValues(todo: TodoItem | null): RawFormValues {
  if (todo === null) {
    return { title: "", dueDate: "", priority: "medium", tagsText: "" };
  }
  return {
    title: todo.title,
    dueDate: todo.dueDate ?? "",
    priority: todo.priority,
    tagsText: stringifyTags(todo.tags),
  };
}
