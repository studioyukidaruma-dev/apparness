/**
 * todo-app の組み上げ（結線）コード。
 *
 * ここでは 03-features 配下の各機能（の src）を「呼び出して繋ぐ」ことに徹し、
 * 各機能の内部実装（バリデーション・描画詳細・永続化キー名など）には一切立ち入らない。
 * 結線の対応関係は apps/todo-app/02-design/architecture.machine.yaml の interfaces[] と
 * 1対1に対応する（各セクションのコメントに interfaces[] のインデックスを記載）。
 */
import {
  loadTodoList,
  saveTodoList,
  TodoStorageError,
} from "../../../03-features/todo-storage/src/index";
import {
  applyTodoCommand,
  TodoCrudError,
  type TodoCommand,
  type TodoItem,
} from "../../../03-features/todo-crud/src/index";
import { createTodoForm, type TodoFormHandle } from "../../../03-features/todo-form/src/index";
import { renderTodoListView } from "../../../03-features/todo-list-view/src/index";
import "../../../03-features/todo-list-view/src/todo-list-view.css";
import {
  filterAndSortTodos,
  FilterSortControls,
  type FilterSortCriteria,
} from "../../../03-features/todo-filter-sort/src/index";
import "./style.css";

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`assembly: #${id} が見つかりません（index.html を確認してください）`);
  }
  return el;
}

const formSection = requireElement("form-section");
const filterSortSection = requireElement("filter-sort-section");
const listSection = requireElement("list-section");
const storageWarning = requireElement("storage-warning");

function showStorageWarning(message: string): void {
  storageWarning.textContent = `保存に関する警告: ${message}`;
  storageWarning.hidden = false;
}

// --- アプリ状態（この組み上げ層だけが持つ。各機能はステートレス/呼び出しごとに完結する） ---
let todoList: TodoItem[] = [];
let filterSortCriteria: FilterSortCriteria = {};
let editTargetTodo: TodoItem | null = null;
let formHandle: TodoFormHandle | null = null;

// interfaces[0]: todo-storage.persisted_todo_list -> todo-crud.initial_todo_list
function loadInitialTodoList(): TodoItem[] {
  try {
    const result = loadTodoList();
    if (result.error) {
      showStorageWarning(result.error.message);
    }
    return result.todoList;
  } catch (error) {
    if (error instanceof TodoStorageError) {
      showStorageWarning(error.message);
      return [];
    }
    throw error;
  }
}

// interfaces[1]: todo-crud.todo_list -> todo-storage.todo_list_to_persist
function persistTodoList(): void {
  try {
    saveTodoList(todoList);
  } catch (error) {
    if (error instanceof TodoStorageError) {
      showStorageWarning(error.message);
      return;
    }
    throw error;
  }
}

// interfaces[2]+[3]: todo-crud.todo_list -> todo-filter-sort.source_todo_list -> display_todo_list -> todo-list-view.display_todo_list
function renderList(): void {
  const displayTodoList = filterAndSortTodos(todoList, filterSortCriteria);
  renderTodoListView(listSection, displayTodoList, {
    onCommand: handleCommandFromListView,
    onEditRequested: handleEditRequestedFromListView,
  });
}

// interfaces[6]: todo-list-view.edit_requested_todo -> todo-form.edit_target_todo
function renderForm(): void {
  formHandle?.destroy();
  formSection.textContent = "";
  formHandle = createTodoForm({
    editTargetTodo,
    onSubmit: handleCommandFromForm,
  });
  formSection.appendChild(formHandle.element);
}

/** todo-crud へコマンドを適用し、永続化・再描画まで行う共通処理。 */
function applyCommandAndRefresh(command: TodoCommand): void {
  try {
    todoList = applyTodoCommand(todoList, command);
  } catch (error) {
    if (error instanceof TodoCrudError) {
      // EMPTY_TITLE は todo-form が送信前にブロック済み、TODO_NOT_FOUND は多重クリック等の
      // 想定外操作時のみ発生しうる。ユーザー操作を止めずログにのみ残す。
      console.warn(`todo-crud: ${error.code} - ${error.message}`);
      return;
    }
    throw error;
  }
  persistTodoList();
  renderList();
}

// interfaces[5]: todo-list-view.todo_command -> todo-crud.todo_command
function handleCommandFromListView(command: TodoCommand): void {
  if (editTargetTodo && "id" in command && command.id === editTargetTodo.id) {
    // 編集中のタスクが一覧側で削除/完了切替された場合はフォームを新規追加モードに戻す
    editTargetTodo = null;
    renderForm();
  }
  applyCommandAndRefresh(command);
}

function handleEditRequestedFromListView(todo: TodoItem): void {
  editTargetTodo = todo;
  renderForm();
}

// interfaces[4]: todo-form.todo_command -> todo-crud.todo_command
function handleCommandFromForm(command: TodoCommand): void {
  editTargetTodo = null;
  applyCommandAndRefresh(command);
  renderForm();
}

// --- 絞り込み・並び替え UI（todo-filter-sort が提供するコントロールをそのままマウントする） ---
new FilterSortControls(
  filterSortSection,
  (criteria) => {
    filterSortCriteria = criteria;
    renderList();
  },
  filterSortCriteria,
);

// --- 起動 ---
todoList = loadInitialTodoList();
renderForm();
renderList();
