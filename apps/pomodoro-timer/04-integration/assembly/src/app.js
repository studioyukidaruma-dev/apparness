// 04-integration/assembly/src/app.js
//
// architecture.machine.yaml の interfaces[] に定義された2本の結線だけを行うファイル。
// 各機能の内部実装（DOM構造・状態管理の方法・永続化方法）には一切手を入れず、
// 各機能が公開しているモジュール（timer-core/src/main.js, settings/src/settings.js
// + settings/src/ui.js, session-log/src/index.js）の公開APIを呼び出して繋ぐだけに徹する。
//
//   interfaces[0]: settings.timer_settings      -> timer-core.timer_settings
//   interfaces[1]: timer-core.work_session_completed -> session-log.work_session_completed

import { mountTimerUI } from "../../../03-features/timer-core/src/main.js";
import { getSettings } from "../../../03-features/settings/src/settings.js";
import { mountSettingsForm } from "../../../03-features/settings/src/ui.js";
import {
  createSessionLog,
  queryElements,
  bindSessionLogUI,
} from "../../../03-features/session-log/src/index.js";

/**
 * interfaces[0]: settings が出力する timer_settings を timer-core に渡す。
 * settings.js の getSettings()（公開API）が返す値をそのまま
 * timer-core の engine.updateSettings()（公開API）に渡すだけで、双方の内部実装には
 * 一切関与しない。timer-core 側は「進行中のセッションには即時反映せず、次回の
 * start/reset で読み込む」という契約（contract.yaml）を自身の実装で担保している。
 *
 * @param {import("../../../03-features/timer-core/src/timerEngine.js").TimerEngine} engine
 * @returns {void}
 */
export function pushLatestSettingsToTimer(engine) {
  engine.updateSettings(getSettings());
}

/**
 * interfaces[1]: timer-core が出力する work_session_completed を session-log に渡す。
 * engine.on()（公開API）で購読し、受け取ったイベントをそのまま
 * sessionLog.onWorkSessionCompleted()（公開API）に渡すだけ。イベントの形は
 * 両機能の contract.yaml で合意済みの work_session_completed そのもの。
 *
 * @param {import("../../../03-features/timer-core/src/timerEngine.js").TimerEngine} engine
 * @param {import("../../../03-features/session-log/src/session-log.js").SessionLog} sessionLog
 * @returns {() => void} 購読解除関数
 */
export function wireWorkSessionCompletedToSessionLog(engine, sessionLog) {
  return engine.on("workSessionCompleted", (event) => {
    sessionLog.onWorkSessionCompleted(event);
  });
}

/**
 * 単純なクリックで切り替えるタブ（この結線コード自身のUIであり、
 * どの機能の内部実装でもない）。
 * @param {ParentNode & { querySelectorAll: Function }} root
 */
export function bindTabs(root) {
  const tabButtons = Array.from(root.querySelectorAll("[data-tab-target]"));
  const panels = Array.from(root.querySelectorAll("[data-tab-panel]"));

  function activate(target) {
    for (const panel of panels) {
      panel.hidden = panel.dataset.tabPanel !== target;
    }
    for (const button of tabButtons) {
      const isActive = button.dataset.tabTarget === target;
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    }
  }

  for (const button of tabButtons) {
    button.addEventListener("click", () => activate(button.dataset.tabTarget));
  }
}

/**
 * 3機能を1つの画面に組み上げる。各機能のマウント関数・公開APIを呼び出すだけで、
 * 内部実装（DOM構造の詳細・状態の持ち方等）には立ち入らない。
 *
 * @param {Document} root
 * @returns {{ engine: object, sessionLog: object }}
 */
export function bootstrapApp(root = document) {
  // --- timer-core: 起動時点の最新設定（settingsの公開API経由）で初期化する ---
  const mountedTimer = mountTimerUI(root, getSettings());
  const { engine } = mountedTimer;

  // --- session-log: timer-coreの完了イベントを結線する（interfaces[1]） ---
  const sessionLog = createSessionLog();
  const sessionLogElements = queryElements(root);
  bindSessionLogUI(sessionLog, sessionLogElements);
  wireWorkSessionCompletedToSessionLog(engine, sessionLog);

  // --- settings: 保存のたびに最新のtimer_settingsをtimer-coreへ反映する（interfaces[0]） ---
  const settingsRoot = root.getElementById("settings-root");
  const { form: settingsForm } = mountSettingsForm(settingsRoot);
  // settingsForm の submit ハンドラは mountSettingsForm() 内部で既に登録済みで、
  // 保存の成否判定・localStorageへの永続化はそちらが行う。ここで追加登録する
  // リスナーは同一要素に対して後から登録するため、DOM仕様上 target フェーズでは
  // 登録順に実行される＝内部の保存処理が完了した"後"に呼ばれることが保証される。
  // そのため getSettings() を呼び直せば、保存が成功していれば新しい値、
  // 失敗していれば直前の値がそのまま返る（内部実装を書き換えずに安全に結線できる）。
  settingsForm.addEventListener("submit", () => {
    pushLatestSettingsToTimer(engine);
  });

  bindTabs(root);

  // stop はテスト・ページ離脱時などに timer-core の描画用 setInterval を止めるために
  // そのまま公開する（mountTimerUI の戻り値をそのまま横流ししているだけ）。
  return { engine, sessionLog, stop: mountedTimer.stop };
}

if (typeof document !== "undefined" && document.getElementById("app-root")) {
  bootstrapApp(document);
}
