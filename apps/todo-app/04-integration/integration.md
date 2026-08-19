# 組み上げ記録: TODOアプリ

- app_id: `todo-app`

## 統合手順

各機能ブランチを `main` にマージした順序と、`architecture.machine.yaml` の `interfaces[]` に
従ってどう結線したかを記録する。

事前準備として、ハーネス本体（`harness/`, `.claude/`）と要件定義・アーキテクチャ設計
（`apps/todo-app/00-requirements/`, `01-foundation/`, `02-design/`）が main 未コミットの
ままだったため、統合作業の前提として先に main へコミットした
（`d671dc6`, `4232cd1`）。また各 feature worktree 側でも実装ファイルが未コミットの
状態（builder による実装は working tree にのみ存在）だったため、各 feature ブランチへ
コミットしてから main へマージした。

| feature_id | マージ日 | コミット |
|---|---|---|
| todo-storage | 2026-08-19 | `af64ed0` (merge), `99dfa79` (実装コミット on feature branch) |
| todo-crud | 2026-08-19 | `1a0ce2d` (merge), `9986749` (実装コミット on feature branch) |
| todo-form | 2026-08-19 | `914535a` (merge), `625bd74` (実装コミット on feature branch) |
| todo-list-view | 2026-08-19 | `d679e12` (merge), `ba6230b` (実装コミット on feature branch) |
| todo-filter-sort | 2026-08-19 | `b02c6ea` (merge), `9138822` (実装コミット on feature branch) |

すべて `git merge --no-ff` で統合。各機能は `03-features/<feature-id>/` という排他的な
パスのみを変更していたため、コンフリクトは発生しなかった。

## 結線の実装箇所

結線コードは `apps/todo-app/04-integration/assembly/` に置いた、Vite + TypeScript の
最小限のブラウザアプリ（`index.html` / `src/main.ts` / `src/style.css`）。
`src/main.ts` は各機能の `03-features/<feature-id>/src/index.ts` が公開する関数・クラスを
そのまま呼び出して繋ぐだけで、各機能の内部実装（バリデーション、DOM描画の詳細、
localStorage のキー名など）には一切手を入れていない。

`interfaces[]` の各エントリについて、実際にどのファイル・関数で結線したかを記録する。

| producer_feature → consumer_feature | 結線コード |
|---|---|
| todo-storage.persisted_todo_list → todo-crud.initial_todo_list | `assembly/src/main.ts` の `loadInitialTodoList()`。`loadTodoList()` の戻り値 `todoList` をモジュール変数 `todoList`（todo-crud の状態表現）の初期値として使う。 |
| todo-crud.todo_list → todo-storage.todo_list_to_persist | `assembly/src/main.ts` の `persistTodoList()`。`applyTodoCommand()` の戻り値で更新した `todoList` を、コマンド適用のたびに `saveTodoList(todoList)` へそのまま渡す（`applyCommandAndRefresh()` から呼び出し）。 |
| todo-crud.todo_list → todo-filter-sort.source_todo_list | `assembly/src/main.ts` の `renderList()`。`todoList` を `filterAndSortTodos(todoList, filterSortCriteria)` の第一引数に渡す。 |
| todo-filter-sort.display_todo_list → todo-list-view.display_todo_list | `assembly/src/main.ts` の `renderList()`。`filterAndSortTodos()` の戻り値 `displayTodoList` を `renderTodoListView(listSection, displayTodoList, callbacks)` の第二引数に渡す。 |
| todo-form.todo_command → todo-crud.todo_command | `assembly/src/main.ts` の `createTodoForm({ onSubmit: handleCommandFromForm })`。フォーム送信時に発行された `TodoCommand`（add/edit）を `handleCommandFromForm` → `applyCommandAndRefresh()` 経由で `applyTodoCommand()` に渡す。 |
| todo-list-view.todo_command → todo-crud.todo_command | `assembly/src/main.ts` の `renderTodoListView(..., { onCommand: handleCommandFromListView })`。一覧上のチェック/削除操作で発行された `TodoCommand`（toggle_complete/delete）を `handleCommandFromListView` → `applyCommandAndRefresh()` 経由で `applyTodoCommand()` に渡す。 |
| todo-list-view.edit_requested_todo → todo-form.edit_target_todo | `assembly/src/main.ts` の `handleEditRequestedFromListView(todo)`。一覧上の編集操作で渡された `TodoItem` をモジュール変数 `editTargetTodo` に保持し、`renderForm()` が `createTodoForm({ editTargetTodo, ... })` に渡してフォームを再構築する。 |

その他、`todo-filter-sort` が提供する絞り込み・並び替え UI（`FilterSortControls`）は
`assembly/src/main.ts` から `new FilterSortControls(filterSortSection, onChange, initialCriteria)`
としてそのままマウントし、`onChange` で受け取った条件を `filterSortCriteria` に保持して
`renderList()` を再実行する構成にした（この UI 自体は todo-filter-sort 機能に閉じており、
architecture.machine.yaml 上も他機能からの入力ではなく自己完結の入力として定義されている）。

`todo-list-view` の見た目（`src/todo-list-view.css`）は機能側の資産としてそのまま
`assembly/src/main.ts` から import し、組み上げ層側の `src/style.css` はレイアウト
（ヘッダー・セクション枠・フォームの最小限のスタイル）のみを追加している。

## 統合テスト結果

- 各機能の単体テスト（vitest）は main 統合後も全てグリーン:
  - todo-storage: 13/13 passed
  - todo-crud: 17/17 passed
  - todo-form: 30/30 passed
  - todo-list-view: 15/15 passed
  - todo-filter-sort: 13/13 passed
- `apps/todo-app/04-integration/assembly` で `npm install` → `tsc --noEmit`（エラーなし）
  → `vite build`（成功、`dist/` 生成）を確認。
- `vite preview` で `dist/` をローカル配信し、Google Chrome (headless, puppeteer-core 経由)
  で実際のブラウザ操作を自動化して以下をすべて確認（15/15 成功）:
  - 初期表示（タスクなし）
  - タスク追加（タイトル・期限・優先度・タグ指定）
  - 空タイトル送信のブロックとエラーメッセージ表示（todo-form 側の事前バリデーション）
  - 期限超過タスクの視覚的区別（`data-overdue="true"`）
  - 完了チェックの切替
  - 編集開始時のフォームへのプリフィル、編集内容の一覧への反映
  - 絞り込み（未完了のみ）
  - 並び替え（優先度昇順: high → medium → low）
  - 削除
  - リロード後も localStorage（キー: `apparness.todo-app.todos.v1`）からの状態復元（永続化）

## 既知の課題

- ハーネス本体（`harness/`, `.claude/`）と要件定義・設計フェーズの成果物が、統合作業を
  始めた時点で main に一度もコミットされていなかった（各 feature worktree にのみ実装が
  存在していた）。今回は統合の前提としてまとめて main にコミットしたが、本来は各フェーズ
  の担当（`init-app`, `requirements-analyst`, `solution-architect`, `feature-builder`）が
  都度コミットしておくのが望ましい。
- `assembly` は npm/Vite 前提の最小限のビルド構成であり、`03-features/*/src` を
  `../../../03-features/<feature-id>/src/index` という相対パスで直接 import している
  （ビルドツールの `moduleResolution: "Bundler"` を各機能が採用しているため、bundler経由の
  参照を前提とした構成）。機能側のディレクトリ構造を変更する場合は `assembly/src/main.ts`
  の import パスも追従が必要。
- `todo-crud` は `crypto.randomUUID()` を使用するため、`file://` で `index.html` を直接
  開く等の非セキュアコンテキストでは新規追加が失敗する。`npm run dev` / `npm run preview`
  （localhost 経由）での利用を前提とする。
