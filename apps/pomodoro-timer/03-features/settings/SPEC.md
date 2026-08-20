# 機能仕様: 設定

> このディレクトリ（`03-features/settings/`）の中だけを見れば、この機能で何を作るべきかが
> わかるようにしてください。他の機能の内部実装を知る必要はありません。
> 入出力の正式な定義は `contract.yaml` です。ここはそれを人間向けに補足する文書です。

- feature_id: `settings`
- app_id: `pomodoro-timer`
- 進捗状態: `status.yaml` を参照（このファイルには手書きしない）

## この機能が何をするか

作業時間・短い休憩時間・長い休憩時間・長い休憩までの作業セッション数・通知音ON/OFFを
ユーザーが編集できる設定フォーム。入力を検証したうえで `localStorage`
（キー: `pomodoro-timer:settings:v1`）に保存し、現在の設定値（`timer_settings`）を
他機能（timer-core）へ提供する。timer-core がタイマーをどう進行させるか、
session-log がログをどう保存するかは一切知らないし関知しない。

## 入力・出力

正式な定義は `contract.yaml`。

- 入力 `settings_form_input`: フォームから送られる生の値（5項目）。
- 出力 `timer_settings`: 検証・保存済みの値。timer-core が読み込む前提の形。
- 初回アクセス（`localStorage` が空）の場合は既定値
  （25 / 5 / 15 / 4 / true）を返す。

## 実装方針

- `src/validate.js`: 入力検証を行う純粋関数 `validateSettingsInput()`。DOM・localStorage
  に一切依存しない。境界値（0・負数・上限超え・小数・NaN・文字列・boolean以外）を
  すべて `INVALID_INPUT` として拒否する。
- `src/storage.js`: `localStorage` の読み書きのみを担当。書き込み失敗
  （プライベートブラウジング等）を握りつぶさず `STORAGE_UNAVAILABLE` として返す。
  読み込み時は「キーが無い／JSONが壊れている／値が検証を通らない」の
  いずれの場合も例外を投げず既定値にフォールバックする
  （shared-kernel.yaml の data_store.policy に従う）。
- `src/settings.js`: 他機能から見た唯一の公開 API。
  `getSettings()` / `saveSettings(rawInput)` の2関数のみを export する。
  timer-core はこのモジュールの `getSettings()` が返す形（`timer_settings` の
  JSON Schema）だけを信頼すればよい。
- `src/ui.js` + `src/main.js` + `src/index.html` + `src/style.css`:
  フォームのDOM結線と最低限のスタイル。`settings.js` の公開APIのみに依存する。

## テスト方針

`contract.yaml` の `test_strategy` に従い、`validateSettingsInput()` を純粋関数として
vitest で単体テストする（境界値: 0, 負数, 上限超え, 小数, NaN, 文字列型, boolean以外等）。
加えて `storage.js`（フェイク `localStorage` を使った読み書き・エラー系）、
`settings.js`（検証と永続化の結合、保存失敗時に例外を投げないこと）もテスト対象にした。
`localStorage` への実際の読み書き・UIの見た目は `src/index.html` をブラウザで開いて手動確認する
（フォーム入力 → 保存 → リロード後も値が保持されることを確認）。`file://` で直接開くと
ブラウザによっては ES Modules の CORS 制限で `main.js` が読み込めないことがあるため、
`src/` を作業ディレクトリにして簡易HTTPサーバー（例: `python3 -m http.server`）経由で
開くことを推奨する。

`code-review` skill をこの worktree で2回実行したが、いずれもフォーク先のバックグラウンド
プロセスがこの worktree の作業ディレクトリを引き継いでおらず、1回目は無関係な harness の
過去コミット差分を、2回目は空の差分（`main` ブランチ扱い）を対象にレビューしてしまい、
本機能の実装（`src/`配下）そのものはレビューされなかった。そのため実装者自身が
line-by-line diff scan・removed-behavior・cross-file・reuse/simplification/efficiency/
altitude・CLAUDE.md conventions の観点で手動セルフレビューを行い、指摘なしと判断した。

## この機能のスコープ外

- タイマーのカウントダウン進行・開始/一時停止/リセット操作（timer-core の責務）。
- セッション完了記録の保存・一覧表示（session-log の責務）。
- timer-core・session-log が `timer_settings` をどう使うか、どのタイミングで
  読み込むかはこの機能の関知するところではない（`architecture.machine.yaml` の
  `interfaces[]` に委ねる）。
