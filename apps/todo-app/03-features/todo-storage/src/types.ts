/**
 * contract.yaml の inputs/outputs で定義された TodoItem のスキーマに対応する型。
 * この型は todo-storage の契約に閉じたローカル定義であり、他機能の内部型を参照しない。
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

/** contract.yaml の error_cases の code 一覧 */
export type StorageErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_QUOTA_EXCEEDED"
  | "STORAGE_DATA_CORRUPTED";
