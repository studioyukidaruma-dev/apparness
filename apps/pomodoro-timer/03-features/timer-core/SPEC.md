# 機能仕様: タイマー本体

> このディレクトリ（`03-features/timer-core/`）の中だけを見れば、この機能で何を作るべきかが
> わかるようにしてください。他の機能の内部実装を知る必要はありません。
> 入出力の正式な定義は `contract.yaml` です。ここはそれを人間向けに補足する文書です。

- feature_id: `timer-core`
- app_id: `pomodoro-timer`
- 進捗状態: `status.yaml` を参照（このファイルには手書きしない）

## この機能が何をするか

作業（WORK）・小休憩（SHORT_BREAK）・長い休憩（LONG_BREAK）の3種のセッションを
`timer_settings` の分数に従ってカウントダウンし、作業セッションが `sessions_until_long_break`
回完了するごとに次の休憩を長い休憩に切り替える。開始・一時停止・再開・リセットの4操作を
受け付け、UIの残り時間・セッション種別表示を毎秒更新する。作業セッションが1件完了した
瞬間に `work_session_completed` イベントを1回だけ発火する。設定値・記録の永続化方法は
一切知らない。

## 入力・出力

正式な定義は `contract.yaml`。以下は実装時に決めた、契約に明示されていない詳細の補足。

## 実装方針

- `src/timerEngine.js` の `TimerEngine` クラスが中核ロジック。DOM・`setInterval`・`Date.now()`
  に直接依存させず、`now` をコンストラクタオプションとして注入できるようにし、vitestで
  時刻を完全に制御してテストする。
- **カウントダウンの精度**: `setInterval` のコールバック間隔を積算するのではなく、
  セッション開始/再開のたびに「終了予定時刻(`_sessionEndAt`)」を計算し、毎回
  `Math.ceil((終了予定時刻 - 現在時刻) / 1000)` で残り秒数を再計算する
  （non_functional.precision の指示どおり、累積誤差を避ける方式）。
- **状態遷移**: 内部状態は `idle` / `running` / `paused` の3つ。
  - `start`: `idle` のときだけ受理。受理時に最新の `pendingSettings` を読み込み直す。
  - `pause`: `running` のときだけ受理。
  - `resume`: `paused` のときだけ受理。
  - `reset`: 常に受理。現在のセッション種別・サイクル内完了数はそのままに、
    タイマーだけを最新設定の満タンの残り時間へ戻す（サイクル全体の巻き戻しはしない）。
  - 上記以外の組み合わせ（例: 実行中に `start`、待機中に `pause`）は無視し
    `{ accepted: false }` を返す（`COMMAND_IGNORED`）。スキーマのenum外の文字列が来ても
    例外を投げず無視する（防御的な実装、security-baseline.md 1節）。
- **設定の反映タイミング**: `updateSettings()` はいつでも呼べるが、即座には反映しない。
  「次にセッションが開始されたタイミング」を、ユーザー操作の `start` だけでなく、
  自動切替（work→break、break→work）や `reset` も含めて解釈した
  （contract.yaml の該当記述の自然な読み方として採用。設計判断であり、実装の自由度の範囲内）。
- **サイクル管理**: `completed_work_sessions_in_cycle` は作業セッション完了のたびに+1され、
  `sessions_until_long_break` に到達すると次の休憩は `LONG_BREAK` になる。`LONG_BREAK` が
  完了すると0にリセットされ次サイクルの `WORK` に戻る。`SHORT_BREAK` 完了時はカウントを
  変更しない。
- **自動切替の連鎖**: PCスリープ復帰など大きな時刻ジャンプが起きても、1回の `tick()` 呼び出しで
  複数セッション分の自動切替をまとめて処理できるようにしている（無限ループ防止の上限付き）。
- 通知音（`side_effects` の音声再生）は `TimerEngine` の `timerExpired` イベントを
  `src/main.js` 側が購読し、Web Audio API の短いビープ音で実装。DOM/ブラウザAPI依存のため
  自動テスト対象外（test_strategy の記載どおり）。

## テスト方針

`tests/timerSettingsValidator.test.js` で `timer_settings` のスキーマ検証（必須項目・範囲・
型・追加プロパティ拒否）を、`tests/timerEngine.test.js` で以下を検証する。

- 初期状態・start/pause/resume/reset の受理/無視判定
- 経過時間からの残り秒数の再計算（setIntervalの呼び出し回数に依存しないこと）
- 作業セッション完了時の `work_session_completed` イベントの内容と発火回数（休憩完了時は
  発火しないこと）
- `sessions_until_long_break` 到達によるLONG_BREAKへの切替とサイクルカウントのリセット
- 大きな時刻ジャンプ時の複数セッション自動連鎖切替
- 設定変更の反映タイミング（進行中セッションには反映されず、次の開始/自動切替/リセットで反映）
- 不正な `timer_settings` に対する `TimerCoreError(INVALID_SETTINGS)` の送出

DOM結合部分（`src/main.js`・`index.html`）と音声再生は自動テスト対象外とし、`index.html` を
ブラウザで直接開いて開始・一時停止・再開・リセット・自動切替を手動確認する
（`timer_settings` は `src/main.js` の `DEFAULT_TIMER_SETTINGS` を暫定値として使用。
実際の結線はintegratorが行う）。

## この機能のスコープ外

- `timer_settings` の永続化・編集UI（settings機能の責務）。
- `work_session_completed` の記録・一覧表示（session-log機能の責務）。
- 通知音の音源ファイル選定・音量設定（本機能では固定のビープ音のみ）。
