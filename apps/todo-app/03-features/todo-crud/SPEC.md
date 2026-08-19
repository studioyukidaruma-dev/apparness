# 機能仕様: Todo ドメインロジック

> このディレクトリ（`03-features/todo-crud/`）の中だけを見れば、この機能で何を作るべきかが
> わかるようにしてください。他の機能の内部実装を知る必要はありません。
> 入出力の正式な定義は `contract.yaml` です。ここはそれを人間向けに補足する文書です。

- feature_id: `todo-crud`
- app_id: `todo-app`
- 進捗状態: `status.yaml` を参照（このファイルには手書きしない）

## この機能が何をするか

TodoItem の配列（`initial_todo_list`）と、1件のコマンド（`todo_command`: add / edit /
toggle_complete / delete）を受け取り、バリデーションを行った上で新しい TodoItem 配列
（`todo_list`）を組み立てて返す、状態を持たない純粋関数群。localStorage や DOM には
一切触れない。呼び出し側（todo-form / todo-list-view / todo-storage の間を取り持つ
上位のアプリ本体）がメモリ上の現在状態を保持し、コマンドが発生するたびにこの機能の
関数を呼んで新しい状態を得る、という使い方を想定する。

## 入力・出力

正式な定義は `contract.yaml`。実装のエクスポート（`src/index.ts`）:

- `applyTodoCommand(todoList: TodoItem[], command: TodoCommand): TodoItem[]`
  - `todoList` は破壊的に変更しない。常に新しい配列/オブジェクトを返す。
  - バリデーション失敗時は `TodoCrudError`（`code`: `"EMPTY_TITLE"` | `"TODO_NOT_FOUND"`、
    `message: string`）を throw する。`err.toResponse()` で
    `{ code, message }`（contract.yaml の response_shape）を取り出せる。
- 型定義（`TodoItem`, `Priority`, `TodoCommand` とその内訳の `AddTodoCommand` /
  `EditTodoCommand` / `ToggleCompleteTodoCommand` / `DeleteTodoCommand`）も
  `src/index.ts` からエクスポートする。

## 実装方針

- `add`: `crypto.randomUUID()` で id を発行し、`createdAt`/`updatedAt` を現在時刻
  （ISO 8601）で揃えて新規追加する。
- `edit`: 対象 id が存在しなければ `TODO_NOT_FOUND`。`title`/`dueDate`/`priority`/`tags`
  を上書きし、`updatedAt` のみ更新する（`createdAt` は不変）。
- `toggle_complete` / `delete`: 対象 id が存在しなければ `TODO_NOT_FOUND`。
  `toggle_complete` は `completed` を反転して `updatedAt` を更新する。`delete` は配列から除去する。
- `add`/`edit` の `title` は `trim()` して空文字なら `EMPTY_TITLE`。保存する `title` 自体も
  trim 後の値を使う。
- `title` の `maxLength: 200` など JSON Schema 側の形式制約は呼び出し元（todo-form 等）が
  境界で守る前提とし、この機能の error_cases（EMPTY_TITLE / TODO_NOT_FOUND）としては
  追加のバリデーションを行わない。

## テスト方針

`tests/applyTodoCommand.test.ts`（vitest）で以下を検証:

- add/edit/toggle_complete/delete それぞれの正常系（新規追加、更新、完了切替、削除、
  他の要素への非破壊性）
- EMPTY_TITLE（空文字・空白のみ、add と edit の両方）
- TODO_NOT_FOUND（edit/toggle_complete/delete それぞれで存在しない id を指定）
- `createdAt` は add 時のみ設定され edit/toggle_complete では変わらないこと、
  `updatedAt` は edit/toggle_complete のたびに更新されること（`vi.useFakeTimers()` で検証）
- add → edit → toggle_complete → delete を連続適用した際の一貫性

`npm test`（`vitest run`）と `npm run typecheck`（`tsc --noEmit`）で確認済み。

## この機能のスコープ外

- localStorage への読み書き（todo-storage の責務）
- フォーム入力のUI・バリデーションメッセージ表示（todo-form の責務）
- 一覧表示・フィルタ/ソートの見た目（todo-list-view / todo-filter-sort の責務）
- 複数コマンドをどう発火させるか（イベントハンドリング）はこの機能の外側（統合層）の責務。
  この機能は「現在の配列 + 1コマンド → 新しい配列」の変換のみを提供する。
