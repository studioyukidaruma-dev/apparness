# 設計書: TODOアプリ

> このファイルは人間向けです。機械向けの構造化データは `architecture.machine.yaml` と
> `features/<feature-id>.contract.yaml` を参照してください。

- app_id: `todo-app`
- design_version: 1
- based_on_requirements_version: 1
- status: APPROVED
- approved_by: studio.yukidaruma@gmail.com
- approved_at: 2026-08-19T13:00:00Z

## 全体アーキテクチャ概要

本アプリはサーバー・DB・認証を持たないクライアントサイドのみの SPA（要件の制約）。
そのため「機能間のつながり」は HTTP API ではなく、同一ブラウザ内でのデータの受け渡し
（関数呼び出し・イベント）として表現する。5つの独立機能を、TodoItem の配列が循環する
一方向データフローとして接続する。

```
                 (起動時に1回)
  todo-storage --persisted_todo_list--> todo-crud
       ^                                    |
       |                                    | todo_list
       | todo_list_to_persist               v
       +----------------------------- todo-crud --todo_list--> todo-filter-sort
                                            ^                        |
                          todo_command      |                        | display_todo_list
                    +-----------------------+                        v
                    |                                          todo-list-view
              todo-form <---edit_requested_todo------------------- todo-list-view
                    |                                                 |
                    +--------------------- todo_command (add/edit) ---+
                                            (toggle_complete/delete)
```

- `todo-storage` は起動時に保存済みデータを読み込み `persisted_todo_list` として渡す。
- `todo-crud` はコマンド（追加/編集/削除/完了切替）を適用し、新しい `todo_list` を
  `todo-storage`（永続化）と `todo-filter-sort`（表示用加工）の両方に渡す。
- `todo-filter-sort` は絞り込み・並び替え条件（自身のUIから得る）を適用し
  `display_todo_list` を `todo-list-view` に渡す。
- `todo-list-view` は一覧を描画し、ユーザー操作から `todo_command`
  （toggle_complete/delete）や `edit_requested_todo` を発行する。
- `todo-form` は追加/編集の入力を受け付け `todo_command`（add/edit）を発行する。

各機能は上記の入出力さえ満たせば内部実装（DOM構造・状態管理の方法など）を自由に選べる。
機能間に `depends_on` のような直接依存は存在しない（`harness/CONVENTIONS.md` 6節）。

## 共有基盤 (Shared Kernel)

全機能が依存してよい最小限の共有契約。詳細は `../01-foundation/shared-kernel.yaml`。

- `TodoItem`: ドメインの中核エンティティ（id / title / completed / dueDate / priority /
  tags / createdAt / updatedAt）。5機能すべてが直接・間接に扱うため Shared Kernel に置く。
- `auth`: なし（個人利用・単一ユーザー前提でアカウント登録/ログインを持たない）。
- `data_store.policy`: 全データは localStorage にのみ保存し、その読み書きは
  `todo-storage` 機能に閉じる、という方針のみを共有する（キー名等の実装詳細は含めない）。

`TodoCommand`（add/edit/toggle_complete/delete）や `FilterSortCriteria` のような、
一部の機能間 interface にしか登場しない型は Shared Kernel に含めず、関係する各
`contract.yaml` にローカルに定義した（本当に全機能共通のものだけに絞るため）。

## 機能一覧 (Features)

| ID | 名前 | 概要 | 技術スタック | 契約ファイル |
|---|---|---|---|---|
| todo-storage | 永続化アダプタ | localStorageへのTodoItem配列の読み書きのみ担当（FR-10） | TypeScript / vitest, jsdom | `features/todo-storage.contract.yaml` |
| todo-crud | Todoドメインロジック | 追加・編集・削除・完了切替のコマンドを適用する純粋ロジック（FR-1,3,4,5,6,7,8） | TypeScript / vitest | `features/todo-crud.contract.yaml` |
| todo-form | タスク入力フォーム | 追加・編集の入力UI、期限/優先度/カテゴリ設定UI（FR-1,4,6,7,8） | TypeScript / vitest, jsdom | `features/todo-form.contract.yaml` |
| todo-list-view | タスク一覧表示 | 一覧描画、完了切替・削除・編集開始の操作起点（FR-2,3,5,6,7,8） | TypeScript / vitest, jsdom | `features/todo-list-view.contract.yaml` |
| todo-filter-sort | 絞り込み・並び替え | 完了状態・期限・優先度による絞り込み/並び替え（FR-9） | TypeScript / vitest | `features/todo-filter-sort.contract.yaml` |

要件との対応: FR-1〜FR-10はすべて上記いずれかの機能でカバーされる。FR-2（一覧表示）は
`todo-list-view` が描画そのものを、`todo-filter-sort` が表示対象の選定を分担する。

## 機能間のつながり (Interfaces)

| 出力元機能 | 出力 | 入力先機能 | 入力 |
|---|---|---|---|
| todo-storage | persisted_todo_list | todo-crud | initial_todo_list |
| todo-crud | todo_list | todo-storage | todo_list_to_persist |
| todo-crud | todo_list | todo-filter-sort | source_todo_list |
| todo-filter-sort | display_todo_list | todo-list-view | display_todo_list |
| todo-form | todo_command (add/edit) | todo-crud | todo_command |
| todo-list-view | todo_command (toggle_complete/delete) | todo-crud | todo_command |
| todo-list-view | edit_requested_todo | todo-form | edit_target_todo |

機能同士は上表の入出力接続でのみ結合する。`depends_on` のような直接依存は持たせない
（`harness/CONVENTIONS.md` 6節を参照）。

## 技術スタック選定の根拠

要件が「クライアントサイドのみ・サーバー/DB/認証なし・初回表示3秒以内目安」という
軽量さを求めているため、ランタイムに追加の外部ライブラリを持ち込まず、ブラウザ標準API
（`localStorage`, `crypto.randomUUID()`, `Intl.DateTimeFormat` 等）と TypeScript の
みで実装する方針とした。これにより脆弱性・ライセンス・保守状況のレビュー対象を
開発/テスト用ツールに限定できる。

選定・確認したライブラリ（すべて devDependency。2026年8月時点でWebSearchにより
ライセンス・保守状況・既知の脆弱性を確認済み）:

- **TypeScript** (^5.7系を採用): Apache License 2.0。Microsoft主体で活発にメンテナンス
  され、既知の脆弱性なし（OSVデータベース確認、2026-08-01時点）。なお2026年8月時点で
  TypeScript 7（Go実装のネイティブコンパイラ）が登場しているが、まだ新しく安定版としての
  実績が浅いため、実績のある5.x系を採用しシンプルなアプリの安定性を優先する。
- **Vitest** (^4.1系を採用): MIT License。VoidZero Inc.およびコントリビュータにより
  活発にメンテナンス（週次DL多数、直近3ヶ月以内のリリースあり、健全性: Healthy）。
  単体テストランナーとして各機能で採用。5.0はまだRC段階のため、安定版の4.1系を選定。
- **jsdom** (^28系を採用): MIT License。活発にメンテナンス（健全性: Healthy、直近
  リリース2026-07-29）。DOM操作を伴う`todo-form`/`todo-list-view`/`todo-storage`の
  テストで、Node環境上に`window`/`localStorage`をシミュレートするために使用。
- ビルド/バンドルツール（Vite等）は各機能単体の関心事ではなく、`04-integration`で
  全機能を1つの静的サイトへ組み上げる段階の関心事のため、本設計書のfeature単位の
  tech_stackには含めない（統合時に別途選定・記録する）。

## 進捗

進捗そのものはここに手書きしない。`apps/todo-app/PROGRESS.md`（自動生成）を参照。
