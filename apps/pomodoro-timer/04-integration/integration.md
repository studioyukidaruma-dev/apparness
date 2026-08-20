# 組み上げ記録: ポモドーロタイマー

- app_id: `pomodoro-timer`

## 統合手順

各機能ブランチを `main` にマージした順序と、`architecture.machine.yaml` の `interfaces[]` に
従ってどう結線したかを記録する。

| feature_id | マージ日 | コミット |
|---|---|---|
| timer-core | 2026-08-20 | `5d9e618` (`git merge --no-ff feature/pomodoro-timer/timer-core`) |
| settings | 2026-08-20 | `ae275f0` (`git merge --no-ff feature/pomodoro-timer/settings`) |
| session-log | 2026-08-20 | `a4e890b` (`git merge --no-ff feature/pomodoro-timer/session-log`) |

3機能とも `03-features/<feature-id>/` 配下のみを変更しており、マージ時にコンフリクトは
発生しなかった。各ブランチに未コミットの変更は存在しなかった（マージ前に
`git status --porcelain` で確認済み）。

## 結線の実装箇所

`interfaces[]` の各エントリについて、実際にどのファイル・関数で結線したかを記録する。

| producer_feature → consumer_feature | 結線コード |
|---|---|
| `settings.timer_settings` → `timer-core.timer_settings` | `04-integration/assembly/src/app.js` の `pushLatestSettingsToTimer()`。起動時は `mountTimerUI(root, getSettings())` の初期値として渡し、設定フォーム(`settingsForm`)の `submit` イベント（`mountSettingsForm()` 内部の保存処理の後に発火するよう、同じ `form` 要素へ追加登録）のたびに `engine.updateSettings(getSettings())` を呼び直す。`settings.js`/`timer-core` いずれの内部実装も変更していない。 |
| `timer-core.work_session_completed` → `session-log.work_session_completed` | `04-integration/assembly/src/app.js` の `wireWorkSessionCompletedToSessionLog()`。`engine.on("workSessionCompleted", event => sessionLog.onWorkSessionCompleted(event))` で、timer-core が発火するイベントをそのまま session-log の公開APIに渡すだけ。 |

いずれも各機能の contract.yaml に定義された公開API（`timer-core/src/main.js` の
`mountTimerUI()`・`timerEngine.js` の `TimerEngine#on/#updateSettings`、`settings/src/settings.js`
の `getSettings()`、`session-log/src/index.js` の `createSessionLog()/onWorkSessionCompleted()`）
だけを呼び出しており、各機能の内部実装（DOM構造・状態管理方法・永続化方法）は一切書き換えていない。

タブ切り替え（`bindTabs()`）と全体のHTML/CSS（`index.html`, `src/style.css`）は結線コード自身の
UIであり、`harness/quality/design-baseline.md` に従い、既存の `settings/src/style.css`（トマト
テーマ: 完熟トマトの赤アクセント×濃緑がかったチャコール背景）に配色を揃えた。各機能自身の
スタンドアロン用ファイル（`03-features/*/index.html`, `style.css` 等）は変更していない。

## 結合テスト

- テストコードの場所:
  - `apps/pomodoro-timer/04-integration/assembly/tests/wiring.test.js`
    （`interfaces[]` の2本の接続を、各機能の公開APIを直接呼び出す形で単独検証）
  - `apps/pomodoro-timer/04-integration/assembly/tests/scenario.test.js`
    （実際の `index.html` マークアップ + `bootstrapApp()` を通した主要ユーザーシナリオのE2E検証:
    設定変更→保存→タイマー開始→作業セッション完了→セッション記録への反映→全件クリア、
    およびタブ切り替えの排他表示）
- 実行方法: `cd apps/pomodoro-timer/04-integration/assembly && npm install && npm test`
  （`vitest` + `jsdom` 環境。`vitest.config.js` で `test.environment: "jsdom"` を指定）
- 結果: 合格。2テストファイル・6テストすべて通過（2026-08-20T18:03 実行）。
  - `interfaces[0]` (settings → timer-core): 保存した `timer_settings` が次回セッション開始時に
    反映されること、不正入力（`INVALID_INPUT`）は反映されずに直前の値が保たれることを確認。
  - `interfaces[1]` (timer-core → session-log): 作業セッション完了で記録が1件増え、
    休憩セッション完了では増えない（`work_session_completed` が休憩時は発火しない契約通り）ことを確認。
  - E2Eシナリオ: 実際のDOM操作（設定フォーム入力・保存ボタン・タイマー開始ボタン・タブ切り替え・
    全件クリアボタン）を通して一連の操作が破綻なく動くことを確認。
- あわせて、各機能単体の既存テストも main 上で再実行し、退行がないことを確認済み
  （timer-core 38件 / settings 61件 / session-log 38件、すべて通過）。

## セキュリティ・コードレビュー

- `security-review` skill: `04-integration/assembly/` の結線コードを対象に実施。
  HIGH/MEDIUM相当の指摘なし（innerHTMLの生埋め込み・秘密情報のハードコード・
  入力検証のバイパス等は確認されなかった。設定値・イベントはいずれも producer 側/consumer 側の
  既存の検証ロジックを経由してから結線コードに渡っている）。
- `code-review` skill: `ca96f9b`（結線コミット）を対象にシングルパスで実行（Agent tool不使用）。
  指摘1件（`src/style.css` の `.app` の padding が未定義のCSSカスタムプロパティ `--space-6` を
  フォールバック値 `48px` 込みで参照しており、design-baselineの余白トークンとして`:root`に
  実体が無かった）。`:root` に `--space-6: 48px` を追加し、フォールバック無しの参照に修正して対応。
  対応後、結合テスト6件が全て再度通過することを確認。

## 既知の課題

(組み上げ時点で見つかったが未解決の問題)

- 通知音（`timer-core` の Web Audio API 再生）と `<audio>` 要素依存の挙動は、契約上
  automated test 対象外（DOM/ブラウザAPI依存）とされており、結合テストでも未検証。
  ブラウザでの目視・耳による確認は今回のセッションでは実施していない。
