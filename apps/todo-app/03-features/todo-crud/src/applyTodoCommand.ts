import { emptyTitleError, todoNotFoundError } from "./errors.js";
import type { TodoCommand, TodoItem } from "./types.js";

/**
 * タイトルが空文字または空白のみかどうかを判定する（contract.yaml EMPTY_TITLE）。
 */
function isBlank(title: string): boolean {
  return title.trim().length === 0;
}

function assertTitleNotBlank(title: string): void {
  if (isBlank(title)) {
    throw emptyTitleError();
  }
}

function findIndexOrThrow(todoList: readonly TodoItem[], id: string): number {
  const index = todoList.findIndex((todo) => todo.id === id);
  if (index === -1) {
    throw todoNotFoundError(id);
  }
  return index;
}

/**
 * 現在の TodoItem 配列にコマンドを1件適用し、新しい TodoItem 配列を返す純粋関数。
 *
 * - 入力の `todoList` を破壊的に変更しない（常に新しい配列/オブジェクトを返す）。
 * - 同一の入力に対して常に同一の構造の結果を返す（id/timestamp の値そのものは
 *   `crypto.randomUUID()` / 現在時刻に依存するため実行ごとに変わるが、
 *   決定的な入力→出力の「形」は保たれる）。
 * - バリデーションに失敗した場合は `TodoCrudError`（code: EMPTY_TITLE | TODO_NOT_FOUND）を投げる。
 *
 * @throws {TodoCrudError} EMPTY_TITLE - add/edit の title が空文字または空白のみのとき
 * @throws {TodoCrudError} TODO_NOT_FOUND - edit/toggle_complete/delete の id が存在しないとき
 */
export function applyTodoCommand(
  todoList: readonly TodoItem[],
  command: TodoCommand,
): TodoItem[] {
  switch (command.type) {
    case "add": {
      assertTitleNotBlank(command.title);
      const now = new Date().toISOString();
      const newTodo: TodoItem = {
        id: crypto.randomUUID(),
        title: command.title.trim(),
        completed: false,
        dueDate: command.dueDate ?? null,
        priority: command.priority,
        tags: [...command.tags],
        createdAt: now,
        updatedAt: now,
      };
      return [...todoList, newTodo];
    }

    case "edit": {
      assertTitleNotBlank(command.title);
      const index = findIndexOrThrow(todoList, command.id);
      const now = new Date().toISOString();
      return todoList.map((todo, i) => {
        if (i !== index) return todo;
        return {
          ...todo,
          title: command.title.trim(),
          dueDate: command.dueDate ?? null,
          priority: command.priority,
          tags: [...command.tags],
          updatedAt: now,
        };
      });
    }

    case "toggle_complete": {
      const index = findIndexOrThrow(todoList, command.id);
      const now = new Date().toISOString();
      return todoList.map((todo, i) => {
        if (i !== index) return todo;
        return { ...todo, completed: !todo.completed, updatedAt: now };
      });
    }

    case "delete": {
      findIndexOrThrow(todoList, command.id);
      return todoList.filter((todo) => todo.id !== command.id);
    }

    default: {
      // 網羅性チェック。TodoCommand に新しい type が追加された際にコンパイルエラーで気づける。
      const exhaustiveCheck: never = command;
      throw new Error(
        `unknown command type: ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
}
