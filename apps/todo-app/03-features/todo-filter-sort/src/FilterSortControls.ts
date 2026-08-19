import {
  DEFAULT_CRITERIA,
  type CompletedFilter,
  type FilterSortCriteria,
  type SortBy,
  type SortOrder,
} from "./types.js";

const COMPLETED_FILTER_OPTIONS: Array<{ value: CompletedFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "incomplete", label: "未完了" },
  { value: "completed", label: "完了済み" },
];

const SORT_BY_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "none", label: "並び替えなし" },
  { value: "dueDate", label: "期限" },
  { value: "priority", label: "優先度" },
];

const SORT_ORDER_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: "asc", label: "昇順" },
  { value: "desc", label: "降順" },
];

export type FilterSortChangeHandler = (criteria: Required<FilterSortCriteria>) => void;

/**
 * この機能が提供する絞り込み・並び替え条件の UI コントロール。
 * DOM 依存のためブラウザ環境でのみ動作する（テストは filterAndSortTodos の
 * 純粋関数部分に対して行い、この描画ロジック自体は対象外とする）。
 */
export class FilterSortControls {
  private readonly container: HTMLElement;
  private readonly onChange: FilterSortChangeHandler;
  private criteria: Required<FilterSortCriteria>;

  private completedFilterSelect!: HTMLSelectElement;
  private sortBySelect!: HTMLSelectElement;
  private sortOrderSelect!: HTMLSelectElement;

  constructor(
    container: HTMLElement,
    onChange: FilterSortChangeHandler,
    initialCriteria: FilterSortCriteria = {}
  ) {
    this.container = container;
    this.onChange = onChange;
    this.criteria = { ...DEFAULT_CRITERIA, ...initialCriteria };
    this.render();
  }

  getCriteria(): Required<FilterSortCriteria> {
    return { ...this.criteria };
  }

  private render(): void {
    this.container.innerHTML = "";

    this.completedFilterSelect = this.createSelect(
      "todo-filter-sort-completed",
      COMPLETED_FILTER_OPTIONS,
      this.criteria.completedFilter
    );
    this.sortBySelect = this.createSelect(
      "todo-filter-sort-sort-by",
      SORT_BY_OPTIONS,
      this.criteria.sortBy
    );
    this.sortOrderSelect = this.createSelect(
      "todo-filter-sort-sort-order",
      SORT_ORDER_OPTIONS,
      this.criteria.sortOrder
    );

    const handleChange = (): void => {
      this.criteria = {
        completedFilter: this.completedFilterSelect.value as CompletedFilter,
        sortBy: this.sortBySelect.value as SortBy,
        sortOrder: this.sortOrderSelect.value as SortOrder,
      };
      this.onChange(this.getCriteria());
    };

    this.completedFilterSelect.addEventListener("change", handleChange);
    this.sortBySelect.addEventListener("change", handleChange);
    this.sortOrderSelect.addEventListener("change", handleChange);

    this.container.appendChild(this.completedFilterSelect);
    this.container.appendChild(this.sortBySelect);
    this.container.appendChild(this.sortOrderSelect);
  }

  private createSelect<T extends string>(
    name: string,
    options: Array<{ value: T; label: string }>,
    selectedValue: T
  ): HTMLSelectElement {
    const select = document.createElement("select");
    select.name = name;
    select.setAttribute("aria-label", name);
    for (const option of options) {
      const optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      optionElement.selected = option.value === selectedValue;
      select.appendChild(optionElement);
    }
    return select;
  }
}
