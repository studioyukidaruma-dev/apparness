import { describe, expect, it } from "vitest";
import { buildTodoCommand, parseTags, stringifyTags, toRawFormValues, validateTitle } from "../src/formLogic.js";
import type { TodoItem } from "../src/types.js";

describe("validateTitle", () => {
  it("空文字列でTITLE_REQUIREDを返す", () => {
    expect(validateTitle("")).toEqual({
      code: "TITLE_REQUIRED",
      message: expect.any(String),
    });
  });

  it("空白のみでTITLE_REQUIREDを返す", () => {
    expect(validateTitle("   ")).toEqual({
      code: "TITLE_REQUIRED",
      message: expect.any(String),
    });
  });

  it("有効なタイトルでnullを返す", () => {
    expect(validateTitle("牛乳を買う")).toBeNull();
  });
});

describe("parseTags", () => {
  it("カンマ区切りの文字列をトリムして配列にする", () => {
    expect(parseTags(" 買い物 , 家事 ,仕事")).toEqual(["買い物", "家事", "仕事"]);
  });

  it("空要素を除去する", () => {
    expect(parseTags("買い物,,  ,家事")).toEqual(["買い物", "家事"]);
  });

  it("重複するタグを除去する", () => {
    expect(parseTags("買い物,買い物,家事")).toEqual(["買い物", "家事"]);
  });

  it("空文字列は空配列になる", () => {
    expect(parseTags("")).toEqual([]);
  });
});

describe("stringifyTags", () => {
  it("配列をカンマ区切り文字列に変換する", () => {
    expect(stringifyTags(["買い物", "家事"])).toBe("買い物, 家事");
  });

  it("空配列は空文字列になる", () => {
    expect(stringifyTags([])).toBe("");
  });
});

describe("buildTodoCommand", () => {
  it("新規追加時、タイトルのみでaddコマンドを生成する（priority/tags/dueDateのデフォルト値を含む）", () => {
    const result = buildTodoCommand(
      { title: "牛乳を買う", dueDate: "", priority: "medium", tagsText: "" },
      null,
    );
    expect(result).toEqual({
      command: {
        type: "add",
        title: "牛乳を買う",
        dueDate: null,
        priority: "medium",
        tags: [],
      },
    });
  });

  it("新規追加時、全項目入力でaddコマンドを生成する", () => {
    const result = buildTodoCommand(
      { title: "牛乳を買う", dueDate: "2026-08-20", priority: "high", tagsText: "買い物, 家事" },
      null,
    );
    expect(result).toEqual({
      command: {
        type: "add",
        title: "牛乳を買う",
        dueDate: "2026-08-20",
        priority: "high",
        tags: ["買い物", "家事"],
      },
    });
  });

  it("タイトル前後の空白をトリムする", () => {
    const result = buildTodoCommand(
      { title: "  牛乳を買う  ", dueDate: "", priority: "medium", tagsText: "" },
      null,
    );
    expect(result).toEqual({
      command: expect.objectContaining({ title: "牛乳を買う" }),
    });
  });

  it("編集対象IDが指定されている場合、editコマンドを生成する", () => {
    const result = buildTodoCommand(
      { title: "牛乳を買う（更新）", dueDate: "2026-08-25", priority: "low", tagsText: "買い物" },
      "11111111-1111-4111-8111-111111111111",
    );
    expect(result).toEqual({
      command: {
        type: "edit",
        id: "11111111-1111-4111-8111-111111111111",
        title: "牛乳を買う（更新）",
        dueDate: "2026-08-25",
        priority: "low",
        tags: ["買い物"],
      },
    });
  });

  it("タイトルが空の場合はTITLE_REQUIREDエラーを返し、コマンドを生成しない", () => {
    const result = buildTodoCommand(
      { title: "", dueDate: "", priority: "medium", tagsText: "" },
      null,
    );
    expect(result).toEqual({
      error: { code: "TITLE_REQUIRED", message: expect.any(String) },
    });
  });

  it("タイトルが空白のみの場合もTITLE_REQUIREDエラーを返す", () => {
    const result = buildTodoCommand(
      { title: "   ", dueDate: "", priority: "medium", tagsText: "" },
      null,
    );
    expect("error" in result).toBe(true);
  });
});

describe("toRawFormValues", () => {
  const todo: TodoItem = {
    id: "22222222-2222-4222-8222-222222222222",
    title: "掃除をする",
    completed: false,
    dueDate: "2026-09-01",
    priority: "high",
    tags: ["家事", "定期"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  it("TodoItemからRawFormValuesへ変換する", () => {
    expect(toRawFormValues(todo)).toEqual({
      title: "掃除をする",
      dueDate: "2026-09-01",
      priority: "high",
      tagsText: "家事, 定期",
    });
  });

  it("dueDateがnullの場合は空文字列にする", () => {
    expect(toRawFormValues({ ...todo, dueDate: null }).dueDate).toBe("");
  });

  it("nullの場合は新規追加モード相当の空の値を返す", () => {
    expect(toRawFormValues(null)).toEqual({
      title: "",
      dueDate: "",
      priority: "medium",
      tagsText: "",
    });
  });
});
