import type { StorageErrorCode } from "./types";

/**
 * contract.yaml の error_cases.response_shape ({ code, message }) を表す例外クラス。
 * loadTodoList / saveTodoList が投げる例外はすべてこのクラスのインスタンス。
 */
export class TodoStorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TodoStorageError";
    this.code = code;
  }

  /** contract.yaml の error_cases.response_shape そのままの形で取り出す */
  toResponse(): { code: StorageErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}
