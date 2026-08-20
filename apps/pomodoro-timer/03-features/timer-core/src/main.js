// DOM結合部分。timerEngine.js の純粋ロジックとブラウザAPI(setInterval/Audio/DOM)を繋ぐ。
// この機能単体で開いて動作確認できるよう、timer_settings は既定値をここに置く。
// 実際の settings 機能との結線は integrator が行う（差し替え可能な形にしておく）。

import { TimerEngine } from "./timerEngine.js";
import { TimerCoreError } from "./timerCoreError.js";

// settings機能が本来提供する timer_settings の既定値プレースホルダー。
// このオブジェクトを外部から差し替えられるよう、DEFAULT_TIMER_SETTINGS として公開する。
export const DEFAULT_TIMER_SETTINGS = Object.freeze({
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  sessions_until_long_break: 4,
  sound_enabled: true,
});

const SESSION_LABELS = {
  WORK: "作業",
  SHORT_BREAK: "小休憩",
  LONG_BREAK: "長い休憩",
};

function formatMMSS(totalSeconds) {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * 通知音を再生する（Web Audio APIでの短いビープ音。外部音源ファイルに依存しない）。
 * 自動テスト対象外（DOM/ブラウザAPI依存のため手動確認で補う: contract.yaml test_strategy）。
 */
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
    oscillator.onended = () => ctx.close();
  } catch (error) {
    // 音声再生の失敗はタイマー本体の動作に影響させない(エラーを握りつぶさず、握りつぶす対象を
    // 副次的な演出に限定してログにのみ残す。security-baseline.md 5節の例外の扱いに準じる)
    console.error("timer-core: failed to play notification sound", error);
  }
}

/**
 * DOM要素を初期化し、タイマーの表示・操作を結線する。
 * @param {object} [initialSettings] 差し替え用の timer_settings（省略時は既定値）
 */
export function mountTimerUI(root = document, initialSettings = DEFAULT_TIMER_SETTINGS) {
  const sessionTypeEl = root.getElementById("timer-session-type");
  const remainingEl = root.getElementById("timer-remaining");
  const startBtn = root.getElementById("timer-start");
  const pauseBtn = root.getElementById("timer-pause");
  const resumeBtn = root.getElementById("timer-resume");
  const resetBtn = root.getElementById("timer-reset");
  const cycleEl = root.getElementById("timer-cycle");
  const errorEl = root.getElementById("timer-error");

  let engine;
  try {
    engine = new TimerEngine(initialSettings);
  } catch (error) {
    if (error instanceof TimerCoreError && errorEl) {
      errorEl.textContent = `設定エラー: ${error.details.join(", ")}`;
      errorEl.hidden = false;
    }
    throw error;
  }

  engine.on("timerExpired", ({ soundEnabled }) => {
    if (soundEnabled) playNotificationSound();
  });

  function render() {
    const state = engine.tick();
    if (sessionTypeEl) {
      sessionTypeEl.textContent = SESSION_LABELS[state.session_type];
      // 色だけに頼らずラベル文字でも区別できるようにしつつ、配色切替用に種別をdata属性へ反映する
      sessionTypeEl.dataset.session = state.session_type;
    }
    if (remainingEl) remainingEl.textContent = formatMMSS(state.remaining_seconds);
    if (cycleEl) {
      cycleEl.textContent = `完了した作業セッション: ${state.completed_work_sessions_in_cycle}`;
    }
    if (startBtn) startBtn.disabled = state.is_running;
    if (pauseBtn) pauseBtn.disabled = !state.is_running;
    if (resumeBtn) resumeBtn.disabled = state.is_running;
    return state;
  }

  function dispatch(command) {
    engine.handleCommand(command);
    render();
  }

  startBtn?.addEventListener("click", () => dispatch("start"));
  pauseBtn?.addEventListener("click", () => dispatch("pause"));
  resumeBtn?.addEventListener("click", () => dispatch("resume"));
  resetBtn?.addEventListener("click", () => dispatch("reset"));

  render();
  const intervalId = setInterval(render, 250);

  return {
    engine,
    stop: () => clearInterval(intervalId),
  };
}

if (typeof document !== "undefined" && document.getElementById("timer-session-type")) {
  mountTimerUI(document);
}
