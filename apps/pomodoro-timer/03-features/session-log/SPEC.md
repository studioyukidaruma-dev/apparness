# 機能仕様: セッション記録

> このディレクトリ（`03-features/session-log/`）の中だけを見れば、この機能で何を作るべきかが
> わかるようにしてください。他の機能の内部実装を知る必要はありません。
> 入出力の正式な定義は `contract.yaml` です。ここはそれを人間向けに補足する文書です。

- feature_id: `session-log`
- app_id: `pomodoro-timer`
- 進捗状態: `status.yaml` を参照（このファイルには手書きしない）

## この機能が何をするか

timer-core が作業セッション（休憩ではない）を完了するたびに発火する
`work_session_completed` イベントを受け取り、`completed_at`（完了日時）と
`duration_seconds`（所要時間）を localStorage キー
`pomodoro-timer:session-records:v1` に追記保存する。画面には全件数・
本日の完了件数・記録一覧を表示し、ユーザーは「全件クリア」で記録を
全消去できる。休憩セッション完了時はこのイベント自体が発生しないため、
この機能側で種別によるフィルタリングは行わない。

## 入力・出力

正式な定義は `contract.yaml`。

- 入力 `work_session_completed`: `src/session-store.js` の
  `isValidWorkSessionCompleted` で json_schema（型・必須項目・
  `additionalProperties: false`・`session_type` の `const "WORK"` 等）を
  厳密に検証する。不正な入力は記録に追加せず、処理を先に進めない
  （security-baseline.md 1節）。
- 入力 `clear_records_command`: この機能内の「全件クリア」ボタン押下
  （`src/ui.js` の `bindSessionLogUI`）に対応する。他機能からは渡されない。
- 出力 `session_summary`: `src/session-store.js` の `computeSummary` が
  `{ total_count, today_count, records }` の形で返す。`today_count` は
  ブラウザのローカル暦日基準で「本日」を判定する。

## 実装方針

- ロジック（検証・追加・集計・全件クリア）は DOM にもストレージにも
  依存しない純粋関数として `src/session-store.js` に切り出した。
- localStorage の読み書きは `src/storage.js` に分離し、失敗時は例外を
  投げずに `{ ok: false, error: { code: "STORAGE_UNAVAILABLE", ... } }`
  を返す。呼び出し側（`src/session-log.js`）はこれを受けてメモリ内の
  記録で動作を継続し、UI にエラーバナーを表示する
  （`01-foundation/shared-kernel.yaml` の `data_store.policy` に準拠）。
  なお、保存データそのものが壊れている（不正なJSON）場合は
  `STORAGE_UNAVAILABLE` とは区別し、既定値（空配列）へフォールバックする
  （ストレージへの読み書き自体は成功しているため）。
- `src/session-log.js` の `SessionLog` クラス（`createSessionLog()`）が
  この機能の公開エントリポイント。integrator は
  `sessionLog.onWorkSessionCompleted(event)` /
  `sessionLog.subscribe(listener)` などを呼ぶだけで結線でき、内部実装
  （localStorageキー名やDOM構造）を知る必要はない。
- `completed_at` の検証は、`Date.parse` が "2026-02-30" のような実在
  しない暦日を寛容に丸めて受理してしまう（例:
  "2026-03-02" として解釈される）性質があるため、`isValidIsoDateTime`
  で年月日・時分秒の値の範囲を明示的にチェックしている。

## テスト方針

`tests/` に vitest でユニットテストを書いた（38件、全て通過）。

- `session-store.test.js`: 入力検証（型・必須項目・追加プロパティ拒否・
  存在しない暦日の拒否等）、記録追加、全件クリア、本日件数集計
  （日付をまたいだ場合の挙動を含む）を検証。
- `storage.test.js`: フェイクの `Storage` 実装を使い、正常系・
  ストレージアクセス失敗・保存データ破損（JSON不正）の各ケースを検証。
- `session-log.test.js`: `SessionLog` クラスの公開APIを結合的に検証
  （記録追加・永続化・全件クリア・購読通知・不正入力の無視・
  ストレージ利用不可時のフォールバック）。
- `format.test.js`: 表示用フォーマット関数の純粋関数テスト。

localStorage への実読み書き（ブラウザ環境依存）と DOM 描画
（`src/ui.js`）は自動テスト対象外とし、`index.html` を単体で開いての
目視確認に委ねている（test_strategy に明記の方針）。

## この機能のスコープ外

- timer-core がいつ・どのようにカウントダウンしているかは一切関知しない。
  `work_session_completed` イベントの受信だけに反応する。
- 休憩セッションの記録は対象外（イベント自体が発生しないため、この機能
  側でのフィルタ実装は不要）。
- settings 機能の設定値（作業時間等）は一切参照しない。
- 04-integration での実際のイベント配線（timer-core → session-log）は
  integrator の責務。この機能単体では `index.html` の「イベント注入」
  ボタンで代替確認する。
