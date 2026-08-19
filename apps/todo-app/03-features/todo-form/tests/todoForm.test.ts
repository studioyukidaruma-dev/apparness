import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTodoForm } from "../src/todoForm.js";
import type { TodoCommand, TodoItem } from "../src/types.js";

function getInput(form: HTMLFormElement, name: string): HTMLInputElement {
  const el = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (!el) throw new Error(`input[name=${name}] not found`);
  return el;
}

function getSelect(form: HTMLFormElement, name: string): HTMLSelectElement {
  const el = form.querySelector<HTMLSelectElement>(`[name="${name}"]`);
  if (!el) throw new Error(`select[name=${name}] not found`);
  return el;
}

function submit(form: HTMLFormElement): void {
  form.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
}

const editTargetTodo: TodoItem = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "レポートを書く",
  completed: false,
  dueDate: "2026-09-10",
  priority: "high",
  tags: ["仕事"],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("createTodoForm - 新規追加モード", () => {
  it("edit_target_todoが未指定のとき、タイトルと期限を入力して送信するとaddコマンドが発行される", () => {
    const onSubmit = vi.fn<(command: TodoCommand) => void>();
    const { element } = createTodoForm({ editTargetTodo: null, onSubmit });
    document.body.appendChild(element);

    getInput(element, "title").value = "牛乳を買う";
    getInput(element, "dueDate").value = "2026-08-20";
    getSelect(element, "priority").value = "high";
    getInput(element, "tags").value = "買い物, 日用品";

    submit(element);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      type: "add",
      title: "牛乳を買う",
      dueDate: "2026-08-20",
      priority: "high",
      tags: ["買い物", "日用品"],
    });
  });

  it("期限・タグ未入力の場合、dueDate:null, tags:[] のaddコマンドが発行される", () => {
    const onSubmit = vi.fn<(command: TodoCommand) => void>();
    const { element } = createTodoForm({ editTargetTodo: null, onSubmit });
    document.body.appendChild(element);

    getInput(element, "title").value = "牛乳を買う";
    submit(element);

    expect(onSubmit).toHaveBeenCalledWith({
      type: "add",
      title: "牛乳を買う",
      dueDate: null,
      priority: "medium",
      tags: [],
    });
  });

  it("送信成功後、フォームは次の入力のために空の状態に戻る", () => {
    const onSubmit = vi.fn<(command: TodoCommand) => void>();
    const { element } = createTodoForm({ editTargetTodo: null, onSubmit });
    document.body.appendChild(element);

    getInput(element, "title").value = "牛乳を買う";
    submit(element);

    expect(getInput(element, "title").value).toBe("");
  });

  it("タイトルのラベルと入力欄がfor/idで関連付けられている（アクセシビリティ）", () => {
    const { element } = createTodoForm({ editTargetTodo: null, onSubmit: vi.fn() });
    const titleInput = getInput(element, "title");
    const label = element.querySelector<HTMLLabelElement>(`label[for="${titleInput.id}"]`);
    expect(label).not.toBeNull();
  });
});

describe("createTodoForm - 編集モード", () => {
  it("edit_target_todo設定時、フォームの値がプリフィルされる", () => {
    const { element } = createTodoForm({ editTargetTodo, onSubmit: vi.fn() });

    expect(getInput(element, "title").value).toBe("レポートを書く");
    expect(getInput(element, "dueDate").value).toBe("2026-09-10");
    expect(getSelect(element, "priority").value).toBe("high");
    expect(getInput(element, "tags").value).toBe("仕事");
  });

  it("プリフィルされた値をそのまま送信すると、editコマンドがidとともに発行される", () => {
    const onSubmit = vi.fn<(command: TodoCommand) => void>();
    const { element } = createTodoForm({ editTargetTodo, onSubmit });
    document.body.appendChild(element);

    submit(element);

    expect(onSubmit).toHaveBeenCalledWith({
      type: "edit",
      id: "33333333-3333-4333-8333-333333333333",
      title: "レポートを書く",
      dueDate: "2026-09-10",
      priority: "high",
      tags: ["仕事"],
    });
  });

  it("値を編集してから送信すると、変更後の値でeditコマンドが発行される", () => {
    const onSubmit = vi.fn<(command: TodoCommand) => void>();
    const { element } = createTodoForm({ editTargetTodo, onSubmit });
    document.body.appendChild(element);

    getInput(element, "title").value = "レポートを提出する";
    getSelect(element, "priority").value = "low";

    submit(element);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "edit",
        id: "33333333-3333-4333-8333-333333333333",
        title: "レポートを提出する",
        priority: "low",
      }),
    );
  });
});

describe("createTodoForm - バリデーション", () => {
  it("タイトルが空のまま送信すると、TITLE_REQUIREDが通知されtodo_commandは発行されない", () => {
    const onSubmit = vi.fn<(command: TodoCommand) => void>();
    const onError = vi.fn();
    const { element } = createTodoForm({ editTargetTodo: null, onSubmit, onError });
    document.body.appendChild(element);

    submit(element);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ code: "TITLE_REQUIRED", message: expect.any(String) });
  });

  it("タイトルが空白のみの場合も送信されず、エラーメッセージがDOMに表示される", () => {
    const onSubmit = vi.fn<(command: TodoCommand) => void>();
    const { element } = createTodoForm({ editTargetTodo: null, onSubmit });
    document.body.appendChild(element);

    getInput(element, "title").value = "   ";
    submit(element);

    expect(onSubmit).not.toHaveBeenCalled();
    const errorEl = element.querySelector<HTMLParagraphElement>(".todo-form__error");
    expect(errorEl?.hidden).toBe(false);
    expect(errorEl?.textContent).not.toBe("");
  });

  it("エラー後に有効なタイトルを入力して再送信すると、正常にaddコマンドが発行される", () => {
    const onSubmit = vi.fn<(command: TodoCommand) => void>();
    const { element } = createTodoForm({ editTargetTodo: null, onSubmit });
    document.body.appendChild(element);

    submit(element); // 1回目: 空タイトルで失敗
    getInput(element, "title").value = "牛乳を買う";
    submit(element); // 2回目: 成功

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const errorEl = element.querySelector<HTMLParagraphElement>(".todo-form__error");
    expect(errorEl?.hidden).toBe(true);
  });
});

describe("createTodoForm - handle", () => {
  it("reset()を呼ぶと新規追加モードの空の状態に戻る", () => {
    const { element, reset } = createTodoForm({ editTargetTodo, onSubmit: vi.fn() });

    reset();

    expect(getInput(element, "title").value).toBe("");
    expect(getInput(element, "dueDate").value).toBe("");
    expect(getSelect(element, "priority").value).toBe("medium");
    expect(getInput(element, "tags").value).toBe("");
  });

  it("destroy()後はsubmitしてもonSubmitが呼ばれない", () => {
    const onSubmit = vi.fn<(command: TodoCommand) => void>();
    const { element, destroy } = createTodoForm({ editTargetTodo: null, onSubmit });
    document.body.appendChild(element);
    destroy();

    getInput(element, "title").value = "牛乳を買う";
    submit(element);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
