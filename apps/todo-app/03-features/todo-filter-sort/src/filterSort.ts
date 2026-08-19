import {
  DEFAULT_CRITERIA,
  type FilterSortCriteria,
  type Priority,
  type SortOrder,
  type TodoItem,
} from "./types.js";

/**
 * priority の「緊急度順」ランク。数値が小さいほど緊急（high が最優先）。
 * sortBy: "priority" の並び替えはこのランクを基準に行う。
 * （contract.yaml に順序の明記はないため、実装方針として SPEC.md に記載する）
 */
const PRIORITY_RANK: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function applyOrder(compareResult: number, sortOrder: SortOrder): number {
  return sortOrder === "asc" ? compareResult : -compareResult;
}

function compareByDueDate(a: TodoItem, b: TodoItem, sortOrder: SortOrder): number {
  // dueDate が null の項目は常に末尾に置く（昇順・降順どちらでも）。
  if (a.dueDate === null && b.dueDate === null) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  const result = a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
  return applyOrder(result, sortOrder);
}

function compareByPriority(a: TodoItem, b: TodoItem, sortOrder: SortOrder): number {
  const result = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return applyOrder(result, sortOrder);
}

function matchesCompletedFilter(
  item: TodoItem,
  completedFilter: NonNullable<FilterSortCriteria["completedFilter"]>
): boolean {
  switch (completedFilter) {
    case "completed":
      return item.completed === true;
    case "incomplete":
      return item.completed === false;
    case "all":
    default:
      return true;
  }
}

/**
 * source_todo_list に filter_sort_criteria を適用し、display_todo_list を返す純粋関数。
 * 入力配列・要素は変更しない。
 */
export function filterAndSortTodos(
  sourceTodoList: readonly TodoItem[],
  filterSortCriteria?: FilterSortCriteria
): TodoItem[] {
  const criteria: Required<FilterSortCriteria> = {
    ...DEFAULT_CRITERIA,
    ...filterSortCriteria,
  };

  const filtered = sourceTodoList.filter((item) =>
    matchesCompletedFilter(item, criteria.completedFilter)
  );

  if (criteria.sortBy === "none") {
    return filtered;
  }

  const comparator =
    criteria.sortBy === "dueDate"
      ? (a: TodoItem, b: TodoItem) => compareByDueDate(a, b, criteria.sortOrder)
      : (a: TodoItem, b: TodoItem) => compareByPriority(a, b, criteria.sortOrder);

  // Array.prototype.sort は安定ソートであることが仕様上保証されている（ES2019+）ため、
  // 同順位の要素は入力順（フィルタ後の順序）を維持する。
  return [...filtered].sort(comparator);
}
