import { buildTodoCommand, toRawFormValues } from "./formLogic.js";
import type { FormError, Priority, TodoCommand, TodoItem } from "./types.js";

export interface TodoFormOptions {
  /**
   * 編集対象のTodoItem。未指定/null の場合は新規追加モード。
   * contract.yaml: inputs[0] edit_target_todo
   */
  editTargetTodo?: TodoItem | null;
  /**
   * フォーム送信成功時に呼ばれる。
   * contract.yaml: outputs[0] todo_command
   */
  onSubmit: (command: TodoCommand) => void;
  /**
   * バリデーション失敗時に呼ばれる。
   * contract.yaml: error_cases[0] TITLE_REQUIRED
   */
  onError?: (error: FormError) => void;
  /** テスト容易性のため差し替え可能にする。省略時はグローバルの document を使う。 */
  document?: Document;
}

export interface TodoFormHandle {
  /** DOM にマウントする <form> 要素 */
  element: HTMLFormElement;
  /** 入力欄を空（新規追加モード相当）にリセットする */
  reset(): void;
  /** イベントリスナーを解除する */
  destroy(): void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

let uidCounter = 0;
function nextId(prefix: string): string {
  uidCounter += 1;
  return `todo-form-${prefix}-${uidCounter}`;
}

function createField(
  doc: Document,
  labelText: string,
  input: HTMLInputElement | HTMLSelectElement,
): HTMLDivElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "todo-form__field";

  const label = doc.createElement("label");
  label.className = "todo-form__label";
  label.textContent = labelText;
  label.htmlFor = input.id;

  wrapper.append(label, input);
  return wrapper;
}

/**
 * タスク追加・編集用のフォームを構築する。
 * DOM要素を返すのみで、マウント（親要素への append）は呼び出し側（統合先）が行う。
 */
export function createTodoForm(options: TodoFormOptions): TodoFormHandle {
  const doc = options.document ?? document;
  const editTargetTodo = options.editTargetTodo ?? null;

  const form = doc.createElement("form");
  form.className = "todo-form";
  form.setAttribute("novalidate", "true");

  // --- タイトル ---
  const titleInput = doc.createElement("input");
  titleInput.type = "text";
  titleInput.id = nextId("title");
  titleInput.name = "title";
  titleInput.maxLength = 200;
  titleInput.required = true;
  titleInput.autocomplete = "off";

  // --- 期限 ---
  const dueDateInput = doc.createElement("input");
  dueDateInput.type = "date";
  dueDateInput.id = nextId("due-date");
  dueDateInput.name = "dueDate";

  // --- 優先度 ---
  const prioritySelect = doc.createElement("select");
  prioritySelect.id = nextId("priority");
  prioritySelect.name = "priority";
  for (const opt of PRIORITY_OPTIONS) {
    const optionEl = doc.createElement("option");
    optionEl.value = opt.value;
    optionEl.textContent = opt.label;
    prioritySelect.appendChild(optionEl);
  }

  // --- タグ ---
  const tagsInput = doc.createElement("input");
  tagsInput.type = "text";
  tagsInput.id = nextId("tags");
  tagsInput.name = "tags";
  tagsInput.autocomplete = "off";
  tagsInput.placeholder = "カンマ区切りで入力（例: 買い物, 家事）";

  // --- エラーメッセージ表示欄 ---
  const errorEl = doc.createElement("p");
  errorEl.className = "todo-form__error";
  errorEl.id = nextId("error");
  errorEl.setAttribute("role", "alert");
  errorEl.setAttribute("aria-live", "polite");
  errorEl.hidden = true;
  titleInput.setAttribute("aria-describedby", errorEl.id);

  // --- 送信ボタン ---
  const submitButton = doc.createElement("button");
  submitButton.type = "submit";

  function applyMode(target: TodoItem | null): void {
    const values = toRawFormValues(target);
    titleInput.value = values.title;
    dueDateInput.value = values.dueDate;
    prioritySelect.value = values.priority;
    tagsInput.value = values.tagsText;
    submitButton.textContent = target === null ? "追加" : "更新";
    form.dataset.mode = target === null ? "add" : "edit";
  }

  let currentEditTarget = editTargetTodo;
  applyMode(currentEditTarget);

  function showError(error: FormError): void {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
    titleInput.setAttribute("aria-invalid", "true");
  }

  function clearError(): void {
    errorEl.textContent = "";
    errorEl.hidden = true;
    titleInput.removeAttribute("aria-invalid");
  }

  function handleSubmit(event: Event): void {
    event.preventDefault();

    const result = buildTodoCommand(
      {
        title: titleInput.value,
        dueDate: dueDateInput.value,
        priority: prioritySelect.value as Priority,
        tagsText: tagsInput.value,
      },
      currentEditTarget === null ? null : currentEditTarget.id,
    );

    if ("error" in result) {
      showError(result.error);
      options.onError?.(result.error);
      titleInput.focus();
      return;
    }

    clearError();
    options.onSubmit(result.command);

    if (currentEditTarget === null) {
      // 新規追加成功後は次の入力のためフォームを空に戻す
      applyMode(null);
    }
  }

  form.addEventListener("submit", handleSubmit);
  form.append(
    createField(doc, "タイトル", titleInput),
    createField(doc, "期限", dueDateInput),
    createField(doc, "優先度", prioritySelect),
    createField(doc, "タグ", tagsInput),
    errorEl,
    submitButton,
  );

  return {
    element: form,
    reset(): void {
      currentEditTarget = null;
      clearError();
      applyMode(null);
    },
    destroy(): void {
      form.removeEventListener("submit", handleSubmit);
    },
  };
}
