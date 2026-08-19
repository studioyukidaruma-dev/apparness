# 機能仕様: タスク入力フォーム

> このディレクトリ（`03-features/todo-form/`）の中だけを見れば、この機能で何を作るべきかが
> わかるようにしてください。他の機能の内部実装を知る必要はありません。
> 入出力の正式な定義は `contract.yaml` です。ここはそれを人間向けに補足する文書です。

- feature_id: `todo-form`
- app_id: `todo-app`
- 進捗状態: `status.yaml` を参照（このファイルには手書きしない）

## この機能が何をするか

タスクの新規追加・編集を行うための入力フォーム UI。タイトル・期限・優先度・タグ（カンマ区切り）
を入力させ、送信時に `add` または `edit` の `todo_command` を発行する。
`edit_target_todo` が渡されていれば編集モードとして値をプリフィルし `edit` コマンドを、
渡されていなければ新規追加モードとして `add` コマンドを発行する。
空タイトルでの送信はUI側で即座にブロックし `TITLE_REQUIRED` を通知する
（最終防衛は todo-crud 側の `EMPTY_TITLE` が担う。本機能はそれより手前の一次防御）。

## 入力・出力

正式な定義は `contract.yaml`。

- 入力 `edit_target_todo`: `null` なら新規追加モード、`TodoItem` が渡されれば編集モード。
- 出力 `todo_command`: フォーム送信時に呼び出し元へ渡されるコマンドオブジェクト
  （`onSubmit` コールバック引数として渡す。DOM イベントとしては発行しない）。
- エラー `TITLE_REQUIRED`: `onError` コールバックに渡し、かつフォーム内に
  `role="alert"` のメッセージ要素として表示する。

## 実装方針

- フレームワーク非依存の Vanilla TypeScript + DOM API で実装（`tech_stack.framework` が空のため）。
- `createTodoForm(options): TodoFormHandle` が公開エントリポイント（`src/index.ts` / `src/todoForm.ts`）。
  - `options.editTargetTodo?: TodoItem | null`
  - `options.onSubmit: (command: TodoCommand) => void`
  - `options.onError?: (error: FormError) => void`
  - 戻り値 `TodoFormHandle` は `{ element: HTMLFormElement, reset(), destroy() }`。
    `element` を統合先（親コンポーネント／todo-list-view 等）が任意の場所にマウントする。
    本機能自身は `document.body` へのマウントを行わない（統合の責務は 04-integration 側）。
- タグ入力はテキスト入力欄に「カンマ区切り」で入力させ、送信時に trim・空要素除去・重複除去して
  `string[]` に変換する（`src/formLogic.ts: parseTags`）。チップ入力UIなどの高度なUIは行わない。
- バリデーション・コマンド生成のロジックは `src/formLogic.ts` に DOM 非依存な純粋関数として分離し、
  `src/todoForm.ts` がそれを DOM ハンドラに配線する。これによりロジック単体でも高速にテストできる。
- 新規追加モードで送信成功した場合は、フォームを空の状態に戻し連続してタスクを追加できるようにする
  （編集モードでは自動リセットしない。次にどうするかは呼び出し元 UI に委ねる）。

## テスト方針

- `tests/formLogic.test.ts`: DOM非依存の純粋ロジック（`validateTitle` / `parseTags` /
  `stringifyTags` / `buildTodoCommand` / `toRawFormValues`）を vitest の unit test で検証。
- `tests/todoForm.test.ts`: jsdom 環境で `createTodoForm` が生成する実際のフォーム要素を操作し、
  - 新規追加時に正しい `add` コマンドが `onSubmit` に渡ること
  - `edit_target_todo` 設定時に値がプリフィルされ、送信で `edit` コマンド（id付き）が渡ること
  - 空タイトル（空白のみ含む）送信時に `TITLE_REQUIRED` が `onError` に渡り、`onSubmit` は
    呼ばれないこと、エラーメッセージがDOMに表示されること
  - ラベルと入力欄が `for`/`id` で関連付いていること（アクセシビリティ）
  を検証する。

## この機能のスコープ外

- フォーム送信後の実際のタスク追加・更新処理（`todo-crud` の責務）。本機能は `todo_command` という
  データを生成するところまでで、それをどう永続化するかには関与しない。
- 一覧表示・編集開始のトリガーとなるUI（`todo-list-view` の責務）。「編集ボタンを押したら
  `edit_target_todo` を渡してこのフォームを開く」という導線側の実装は行わない。
- フィルタ・ソートのUI（`todo-filter-sort` の責務）。
- localStorage への読み書き（`todo-storage` の責務）。
