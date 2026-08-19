import type { TodoCrudErrorCode } from "./types.js";

/**
 * contract.yaml の error_cases（EMPTY_TITLE / TODO_NOT_FOUND）を表す例外。
 * response_shape（{ code, message }）に対応するプロパティを持つ。
 */
export class TodoCrudError extends Error {
  readonly code: TodoCrudErrorCode;

  constructor(code: TodoCrudErrorCode, message: string) {
    super(message);
    this.name = "TodoCrudError";
    this.code = code;
  }

  /** contract.yaml の response_shape { code, message } の形で取り出す。 */
  toResponse(): { code: TodoCrudErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}

export function emptyTitleError(): TodoCrudError {
  return new TodoCrudError(
    "EMPTY_TITLE",
    "title must not be empty or whitespace only",
  );
}

export function todoNotFoundError(id: string): TodoCrudError {
  return new TodoCrudError("TODO_NOT_FOUND", `todo not found: ${id}`);
}
