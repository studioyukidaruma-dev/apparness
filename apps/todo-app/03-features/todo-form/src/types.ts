/**
 * contract.yaml の inputs/outputs に対応する型定義。
 * TodoItem は 01-foundation/shared-kernel.yaml の共通型と同一形状。
 */

export type Priority = "high" | "medium" | "low";

/** contract.yaml: inputs[0] edit_target_todo */
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

/** contract.yaml: outputs[0] todo_command (type: "add") */
export interface AddTodoCommand {
  type: "add";
  title: string;
  dueDate?: string | null;
  priority: Priority;
  tags: string[];
}

/** contract.yaml: outputs[0] todo_command (type: "edit") */
export interface EditTodoCommand {
  type: "edit";
  id: string;
  title: string;
  dueDate?: string | null;
  priority: Priority;
  tags: string[];
}

export type TodoCommand = AddTodoCommand | EditTodoCommand;

/** contract.yaml: error_cases[0] TITLE_REQUIRED */
export interface FormError {
  code: "TITLE_REQUIRED";
  message: string;
}
