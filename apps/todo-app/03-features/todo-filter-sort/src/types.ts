/**
 * contract.yaml の inputs/outputs にある TodoItem スキーマに対応する型。
 * この機能は TodoItem の生成・更新は行わず、渡された配列を絞り込み・並び替えするだけ。
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

/** contract.yaml `filter_sort_criteria.completedFilter` */
export type CompletedFilter = "all" | "completed" | "incomplete";

/** contract.yaml `filter_sort_criteria.sortBy` */
export type SortBy = "none" | "dueDate" | "priority";

/** contract.yaml `filter_sort_criteria.sortOrder` */
export type SortOrder = "asc" | "desc";

/**
 * contract.yaml `filter_sort_criteria`。
 * 全プロパティ省略可（省略時は全件・入力順として扱う）。
 */
export interface FilterSortCriteria {
  completedFilter?: CompletedFilter;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
}

export const DEFAULT_CRITERIA: Required<FilterSortCriteria> = {
  completedFilter: "all",
  sortBy: "none",
  sortOrder: "asc",
};
