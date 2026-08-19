# 機能仕様: 絞り込み・並び替え

> このディレクトリ（`03-features/todo-filter-sort/`）の中だけを見れば、この機能で何を作るべきかが
> わかるようにしてください。他の機能の内部実装を知る必要はありません。
> 入出力の正式な定義は `contract.yaml` です。ここはそれを人間向けに補足する文書です。

- feature_id: `todo-filter-sort`
- app_id: `todo-app`
- 進捗状態: `status.yaml` を参照（このファイルには手書きしない）

## この機能が何をするか

`todo-crud` などから渡された TodoItem 配列（`source_todo_list`）を、完了状態・期限・優先度
の条件で絞り込み・並び替えし、表示用の配列（`display_todo_list`）として出力する。
絞り込み・並び替え条件（`filter_sort_criteria`）を選択する UI コントロール自体もこの機能に
含まれ、他機能からの出力ではなく、この機能内のユーザー操作から得る自己完結した入力である。

## 入力・出力

正式な定義は `contract.yaml`。

- `source_todo_list`: 加工前の TodoItem 配列全体。
- `filter_sort_criteria`: `completedFilter` / `sortBy` / `sortOrder`。省略可能で、
  未指定時は全件・入力順のまま出力する。
- `display_todo_list`: 上記条件を適用した後の TodoItem 配列。`todo-list-view` がそのまま
  描画する前提の並び順で返す。

## 実装方針

- `src/types.ts`: `TodoItem` / `FilterSortCriteria` などの型定義。
- `src/filterSort.ts`: `filterAndSortTodos(sourceTodoList, filterSortCriteria)` という
  純粋関数として絞り込み・並び替えロジックを実装。DOM 非依存、入力配列・要素は変更しない。
- `src/FilterSortControls.ts`: この機能が持つ絞り込み・並び替え条件の UI コントロール
  （`completedFilter` / `sortBy` / `sortOrder` の3つの `<select>`）。値が変わるたびに
  `onChange` コールバックへ最新の `FilterSortCriteria` を渡す。DOM 依存のためブラウザ環境
  でのみ動作し、単体テストの対象外（純粋関数側でロジックを検証する）。
- `src/index.ts`: 上記のバレルエクスポート。

契約に明記されていない実装上の決定事項（担当者判断。異なる挙動を期待する場合は要相談）:
- `sortBy: "dueDate"` で `dueDate` が `null` の項目は、`sortOrder` の値に関わらず常に末尾に
  配置する。
- `sortBy: "priority"` の順序は「緊急度順」とし、`asc` は `high → medium → low`、
  `desc` は `low → medium → high` とする。
- 同順位の要素は安定ソート（`Array.prototype.sort` の仕様上の保証）によりフィルタ後の入力順
  を維持する。

## テスト方針

`tests/filterSort.test.ts` にて `vitest` による `filterAndSortTodos` の単体テストを実施。

- `filter_sort_criteria` 未指定・空オブジェクト指定時に全件・入力順で返ること
- 入力配列を変更しない（非破壊）こと
- `completedFilter` の `all` / `completed` / `incomplete` 各値での絞り込み結果
- `sortBy: "dueDate"` × `sortOrder: "asc"/"desc"`（`dueDate: null` の扱いを含む）
- `sortBy: "priority"` × `sortOrder: "asc"/"desc"`
- `sortBy: "none"` は並び替えを行わないこと
- フィルタとソートを組み合わせた場合の結果

## この機能のスコープ外

- TodoItem そのものの生成・更新・削除・永続化（`todo-crud` / `todo-storage` の責務）。
- TodoItem 一覧の実際の描画（`todo-list-view` の責務）。この機能は `display_todo_list`
  という配列を出力するのみで、DOM への一覧描画は行わない。
- タグによる絞り込み（`tags` プロパティは通過させるのみで、絞り込み条件には含まれない。
  `contract.yaml` の `filter_sort_criteria` にタグ関連の項目がないため）。
