# 機能仕様: 永続化アダプタ

> このディレクトリ（`03-features/todo-storage/`）の中だけを見れば、この機能で何を作るべきかが
> わかるようにしてください。他の機能の内部実装を知る必要はありません。
> 入出力の正式な定義は `contract.yaml` です。ここはそれを人間向けに補足する文書です。

- feature_id: `todo-storage`
- app_id: `todo-app`
- 進捗状態: `status.yaml` を参照（このファイルには手書きしない）

## この機能が何をするか

ブラウザの `localStorage` への TodoItem 配列の読み書きだけを担う薄い永続化アダプタです。
todo-crud 側は「配列全体を渡して保存する」「起動時に配列全体を読み込む」という 2 操作だけを
この機能に依頼し、キー名やシリアライズ形式などの実装詳細はこの機能に閉じます。

## 入力・出力

正式な定義は `contract.yaml`。公開 API（`src/index.ts`）は以下の 2 関数:

- `loadTodoList(): LoadTodoListResult`
  - `{ todoList: TodoItem[], error: TodoStorageError | null }` を返す。
  - 保存データが無ければ `{ todoList: [], error: null }`。
  - JSON パース失敗 or スキーマ不一致（`STORAGE_DATA_CORRUPTED`）の場合も例外を投げず、
    `{ todoList: [], error: TodoStorageError }` にフォールバックする（contract.yaml の
    outputs 説明どおり「利用不能として扱わない」ため）。
  - `localStorage` 自体にアクセスできない場合（`STORAGE_UNAVAILABLE`）は `TodoStorageError` を **投げる**。
- `saveTodoList(todoList: TodoItem[]): void`
  - `todo_list_to_persist` を受け取り、配列全体で上書き保存する（差分更新ではない）。
  - `STORAGE_UNAVAILABLE` / `STORAGE_QUOTA_EXCEEDED` の場合は `TodoStorageError` を投げる。

`TodoStorageError`（`src/errors.ts`）は `code`（`StorageErrorCode`）と `message` を持ち、
`toResponse()` で contract.yaml の `error_cases.response_shape`（`{ code, message }`）を取得できる。

## 実装方針

- `STORAGE_DATA_CORRUPTED` のみ「例外を投げず空配列にフォールバックしつつ報告」という非致命的な
  扱いにし、`STORAGE_UNAVAILABLE` / `STORAGE_QUOTA_EXCEEDED` は致命的なので例外として投げる、
  という非対称な設計にしている（contract.yaml の error_cases の説明文の違いに基づく判断）。
- localStorage の可用性判定は「`window.localStorage` へのアクセス自体が例外を投げるかどうか」で
  行う（プライベートブラウジング等の制約をシミュレートするテストに対応するため）。
- 容量超過判定は `DOMException` の `name`（`QuotaExceededError` / Firefox の
  `NS_ERROR_DOM_QUOTA_REACHED`）と `code`（22 / 1014）の両方をチェックし、ブラウザ間差異を吸収する。
- このディレクトリは独立した npm プロジェクト（`package.json` / `tsconfig.json` /
  `vitest.config.ts` を同梱）として完結させている。依存関係は `contract.yaml` の
  `tech_stack.libraries`（vitest ^4.1.0, jsdom ^28.0.0）どおり。

## テスト方針

`tests/storage.test.ts`（vitest + jsdom）で以下を検証:

- 保存→読み込みの往復一致（複数件、空配列、上書き保存）
- 保存データ無し時に空配列を返す初期化ケース
- `STORAGE_DATA_CORRUPTED`: 不正な JSON 文字列、スキーマ不一致のオブジェクト・配列要素
- `STORAGE_UNAVAILABLE`: `window.localStorage` アクセス自体が例外を投げるモック
  （`load`/`save` 両方）、`getItem` 自体が例外を投げるモック
- `STORAGE_QUOTA_EXCEEDED`: `setItem` が `QuotaExceededError` / 旧ブラウザ互換のコード 22 を
  投げるモック

jsdom の `localStorage` は Proxy ベースの実装のため `vi.spyOn(window.localStorage, "getItem")`
のようなメソッド差し替えが効かないケースがあった。そのため `window.localStorage` オブジェクト
自体を偽オブジェクトに差し替える `withFakeLocalStorage` ヘルパーでテストしている。

## この機能のスコープ外

- TodoItem の生成・更新・削除といった CRUD ロジック（todo-crud の責務）。
- バリデーションルール（title の長さ制限など）の適用判断。この機能はスキーマ形状のチェック
  （破損データ検知のため）のみ行い、ビジネスルールとしてのバリデーションは行わない。
- サーバー同期・IndexedDB など localStorage 以外の永続化手段への対応。
