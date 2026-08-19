# 機能仕様: タスク一覧表示

> このディレクトリ（`03-features/todo-list-view/`）の中だけを見れば、この機能で何を作るべきかが
> わかるようにしてください。他の機能の内部実装を知る必要はありません。
> 入出力の正式な定義は `contract.yaml` です。ここはそれを人間向けに補足する文書です。

- feature_id: `todo-list-view`
- app_id: `todo-app`
- 進捗状態: `status.yaml` を参照（このファイルには手書きしない）

## この機能が何をするか

`todo-filter-sort` が絞り込み・並び替え済みの `TodoItem[]` を渡してくると、それをそのまま
（自ら絞り込み・並び替えは行わずに）一覧描画する。一覧上の各タスク行では次の3つの操作を
受け付ける。

- 完了チェックボックスのトグル → `{ type: "toggle_complete", id }` を発行（`todo-crud` が消費）
- 削除ボタン → `{ type: "delete", id }` を発行（`todo-crud` が消費）
- 編集ボタン → 対象タスクの `TodoItem` 全体を `edit_requested_todo` として発行（`todo-form` が消費）

また、期限超過（`dueDate` が今日より過去、かつ未完了）のタスクと、優先度（高/中/低）を
CSSクラス・data属性で視覚的に区別できるようにマークアップする（実際の色付けはCSS側の責務とし、
この機能はクラス名/データ属性を正しく付与するところまでを担う）。

## 入力・出力

正式な定義は `contract.yaml`。

- 入力 `display_todo_list`: 絞り込み・並び替え済みの `TodoItem[]`。この機能はこの配列の
  並び順・内容をそのまま描画する。
- 出力 `todo_command`: チェック操作/削除操作から発行される `{ type, id }`。
- 出力 `edit_requested_todo`: 編集操作から発行される対象タスクの `TodoItem` 全体。

呼び出し例（`src/index.ts` からエクスポートされる `renderTodoListView`）:

```ts
import { renderTodoListView } from "./src/index.js";

renderTodoListView(containerElement, todos, {
  onCommand: (command) => { /* todo-crud へ渡す */ },
  onEditRequested: (todo) => { /* todo-form へ渡す */ },
});
```

## 実装方針

- フレームワークは使わず、素の DOM API で描画する（`tech_stack.framework` が空のため）。
- `renderTodoListView(container, todos, callbacks, options?)` が唯一のエントリーポイント。
  呼ばれるたびに `container` の中身を作り直す（差分更新はしない。数百件規模でも
  素朴な再構築で体感遅延がないことをテストで確認済み）。
- 期限超過判定は `src/overdue.ts` の `isOverdue()` に切り出し、`now` を注入可能にすることで
  テストの決定性を確保している（実運用では `now` 省略時に実時刻を使う）。
- 一覧が空配列のときは「タスクがありません」という空状態メッセージを表示する
  （usability の観点での補足。contract 上必須ではない）。
- 期限超過・優先度の視覚的区別（FR-6, FR-7）を満たすための最小限のスタイルシートを
  `src/todo-list-view.css` として同梱している。JS 側はクラス名/データ属性の付与のみを行い、
  実際の色・アイコン表現は CSS 側に分離している。

### DOM マークアップの主な目印（統合時の参照用）

- 一覧コンテナ: `ul.todo-list`
- 各タスク行: `li.todo-item`（`data-testid="todo-item"`, `data-id`, `data-priority` を持つ）
- 期限超過かつ未完了: `li` に `todo-item--overdue` クラスと `data-overdue="true"`
- 完了済み: `li` に `todo-item--completed` クラス
- 優先度: `li` に `todo-item--priority-{high|medium|low}` クラス、
  バッジ要素 `.todo-item__priority.todo-item__priority--{priority}`
- 期限日: `.todo-item__due-date`（期限超過時は `.todo-item__due-date--overdue` も付与）
- タグ: `.todo-item__tag`（`ul.todo-item__tags` の子要素）
- 操作: `.todo-item__checkbox`（change イベントで toggle_complete）、
  `.todo-item__edit-button`（click で edit_requested）、
  `.todo-item__delete-button`（click で delete）

## テスト方針

`vitest` + `jsdom` による単体テスト（`tests/render.test.ts`, `tests/overdue.test.ts`）。

- `display_todo_list` の内容が渡された順序どおりに描画されること
- タイトル・優先度・タグが表示されること
- チェック操作で `toggle_complete` コマンドが発行されること
- 削除操作で `delete` コマンドが発行されること
- 編集操作で対象タスクの `TodoItem` 全体が `edit_requested` として発行されること
- 期限超過かつ未完了のタスクが視覚的に区別されるクラス/属性を持つこと（完了済みは対象外）
- 優先度ごとに区別可能なクラスを持つこと
- 空配列・再描画時のクリア動作

## この機能のスコープ外

- 絞り込み・並び替えのロジック（`todo-filter-sort` の責務）
- チェック/削除/編集内容の実際の永続化・状態更新（`todo-crud` / `todo-storage` の責務）
- 編集フォームそのものの描画・バリデーション（`todo-form` の責務）
- アプリ全体のレイアウト・テーマ（`src/todo-list-view.css` はこの機能のマークアップに対応する
  最小限のスタイルのみを提供する。統合時にこの CSS を読み込むか、同等のスタイルを適用すること）
