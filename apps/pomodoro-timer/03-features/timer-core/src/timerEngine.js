// タイマー本体の中核ロジック。DOM/setInterval から独立した純粋なクラスとして実装し、
// vitest で単体テストできるようにする（contract.yaml test_strategy）。
// 副作用（音声再生・DOM描画）はイベント購読側（src/main.js）に委譲する。

import { validateTimerSettings } from "./timerSettingsValidator.js";
import { TimerCoreError } from "./timerCoreError.js";

export const SESSION_TYPES = Object.freeze({
  WORK: "WORK",
  SHORT_BREAK: "SHORT_BREAK",
  LONG_BREAK: "LONG_BREAK",
});

const KNOWN_COMMANDS = new Set(["start", "pause", "resume", "reset"]);

// 無限ループ対策。PCスリープ復帰など極端な時刻ジャンプでも計算を打ち切れるようにする。
const MAX_AUTO_TRANSITIONS_PER_REFRESH = 100000;

/**
 * 完了したセッションの種別と現在のサイクル内完了数から、次のセッション種別と
 * 次のサイクル内完了数を決める純粋関数。
 * @param {"WORK"|"SHORT_BREAK"|"LONG_BREAK"} completedSessionType
 * @param {number} completedWorkSessionsInCycle
 * @param {number} sessionsUntilLongBreak
 */
export function computeNextSession(
  completedSessionType,
  completedWorkSessionsInCycle,
  sessionsUntilLongBreak,
) {
  if (completedSessionType === SESSION_TYPES.WORK) {
    const nextCompletedCount = completedWorkSessionsInCycle + 1;
    const nextSessionType =
      nextCompletedCount >= sessionsUntilLongBreak
        ? SESSION_TYPES.LONG_BREAK
        : SESSION_TYPES.SHORT_BREAK;
    return { nextSessionType, nextCompletedCount };
  }
  if (completedSessionType === SESSION_TYPES.SHORT_BREAK) {
    return {
      nextSessionType: SESSION_TYPES.WORK,
      nextCompletedCount: completedWorkSessionsInCycle,
    };
  }
  // LONG_BREAK 完了 -> 新しいサイクルの WORK に戻り、カウンタをリセットする
  return { nextSessionType: SESSION_TYPES.WORK, nextCompletedCount: 0 };
}

/**
 * @param {"WORK"|"SHORT_BREAK"|"LONG_BREAK"} sessionType
 * @param {object} settings timer_settings (validate済み)
 */
export function durationSecondsFor(sessionType, settings) {
  switch (sessionType) {
    case SESSION_TYPES.WORK:
      return settings.work_minutes * 60;
    case SESSION_TYPES.SHORT_BREAK:
      return settings.short_break_minutes * 60;
    case SESSION_TYPES.LONG_BREAK:
      return settings.long_break_minutes * 60;
    default:
      throw new Error(`unknown session type: ${sessionType}`);
  }
}

export class TimerEngine {
  /**
   * @param {object} initialSettings timer_settings（未検証の入力として渡してよい）
   * @param {{ now?: () => number }} [options]
   */
  constructor(initialSettings, options = {}) {
    this._now = options.now || (() => Date.now());
    this._listeners = { workSessionCompleted: [], timerExpired: [] };

    /** @type {"idle"|"running"|"paused"} */
    this._status = "idle";
    this.sessionType = SESSION_TYPES.WORK;
    this.completedWorkSessionsInCycle = 0;
    this.remainingSeconds = 0;
    this._sessionEndAt = null;

    this._pendingSettings = null;
    this._activeSettings = null;

    // 初期設定は必ず妥当でなければならない（不正なら INVALID_SETTINGS を投げる）
    this.updateSettings(initialSettings);
    this._loadActiveSettingsForNewSession();
  }

  /**
   * settings機能から渡された最新の timer_settings を受け取る。
   * 進行中のセッションには即時反映しない。次にセッションが開始・自動切替・
   * リセットされたタイミングで読み込まれる。
   * @param {unknown} settings
   * @throws {TimerCoreError} code: INVALID_SETTINGS
   */
  updateSettings(settings) {
    const result = validateTimerSettings(settings);
    if (!result.valid) {
      throw new TimerCoreError("INVALID_SETTINGS", result.errors);
    }
    this._pendingSettings = { ...settings };
  }

  /** @param {"workSessionCompleted"|"timerExpired"} eventName */
  on(eventName, handler) {
    if (!this._listeners[eventName]) {
      throw new Error(`unknown event: ${eventName}`);
    }
    this._listeners[eventName].push(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    const handlers = this._listeners[eventName];
    if (!handlers) return;
    const index = handlers.indexOf(handler);
    if (index !== -1) handlers.splice(index, 1);
  }

  _emit(eventName, payload) {
    for (const handler of this._listeners[eventName]) {
      handler(payload);
    }
  }

  _loadActiveSettingsForNewSession() {
    this._activeSettings = this._pendingSettings;
    this.remainingSeconds = durationSecondsFor(this.sessionType, this._activeSettings);
  }

  /**
   * 開始/一時停止/再開/リセット操作を受け付ける。
   * 現在の状態で意味を持たない操作は無視する（error_cases: COMMAND_IGNORED）。
   * @param {"start"|"pause"|"resume"|"reset"} command
   * @returns {{ accepted: boolean }}
   */
  handleCommand(command) {
    if (!KNOWN_COMMANDS.has(command)) {
      // スキーマ上のenum外の値。クラッシュはさせず無視する。
      return { accepted: false };
    }

    const nowMs = this._now();

    switch (command) {
      case "start": {
        if (this._status !== "idle") return { accepted: false };
        this._loadActiveSettingsForNewSession();
        this._status = "running";
        this._sessionEndAt = nowMs + this.remainingSeconds * 1000;
        return { accepted: true };
      }
      case "pause": {
        // 直前に完了済みのセッションが未反映のまま残っていないか先に清算する
        this._refresh(nowMs);
        if (this._status !== "running") return { accepted: false };
        this.remainingSeconds = this._remainingFromEndAt(nowMs);
        this._status = "paused";
        this._sessionEndAt = null;
        return { accepted: true };
      }
      case "resume": {
        if (this._status !== "paused") return { accepted: false };
        this._status = "running";
        this._sessionEndAt = nowMs + this.remainingSeconds * 1000;
        return { accepted: true };
      }
      case "reset": {
        this._status = "idle";
        this._sessionEndAt = null;
        this._loadActiveSettingsForNewSession();
        return { accepted: true };
      }
      default:
        return { accepted: false };
    }
  }

  _remainingFromEndAt(nowMs) {
    return Math.max(0, Math.ceil((this._sessionEndAt - nowMs) / 1000));
  }

  /**
   * 実行中であれば現在時刻との差分から remaining_seconds を再計算し、
   * 0に到達していれば自動的に次のセッションへ切り替える（複数回のジャンプにも対応）。
   * setInterval のコールバック間隔の累積誤差を避けるため、diffから毎回再計算する
   * （non_functional.precision）。
   * @param {number} nowMs
   */
  _refresh(nowMs) {
    if (this._status !== "running") return;

    let iterations = 0;
    let remaining = this._remainingFromEndAt(nowMs);

    while (remaining <= 0 && iterations < MAX_AUTO_TRANSITIONS_PER_REFRESH) {
      iterations += 1;

      const completedSessionType = this.sessionType;
      const completedDurationSeconds = durationSecondsFor(
        completedSessionType,
        this._activeSettings,
      );
      const soundEnabled = this._activeSettings.sound_enabled;
      const completedAtMs = this._sessionEndAt;

      this._emit("timerExpired", {
        sessionType: completedSessionType,
        soundEnabled,
        completedAtMs,
      });

      if (completedSessionType === SESSION_TYPES.WORK) {
        this._emit("workSessionCompleted", {
          completed_at: new Date(completedAtMs).toISOString(),
          duration_seconds: completedDurationSeconds,
          session_type: "WORK",
        });
      }

      const { nextSessionType, nextCompletedCount } = computeNextSession(
        completedSessionType,
        this.completedWorkSessionsInCycle,
        this._activeSettings.sessions_until_long_break,
      );
      this.sessionType = nextSessionType;
      this.completedWorkSessionsInCycle = nextCompletedCount;

      // 「セッションが開始」されたタイミングとして、この時点の最新設定を読み込む
      this._loadActiveSettingsForNewSession();
      this._sessionEndAt = completedAtMs + this.remainingSeconds * 1000;

      remaining = this._remainingFromEndAt(nowMs);
    }

    this.remainingSeconds = remaining;
  }

  /**
   * 表示状態を再計算して返す。DOM層は setInterval 等から一定間隔でこれを呼ぶ。
   * @param {number} [nowMs]
   * @returns {{session_type: string, remaining_seconds: number, is_running: boolean, completed_work_sessions_in_cycle: number}}
   */
  tick(nowMs = this._now()) {
    this._refresh(nowMs);
    return this.getDisplayState();
  }

  getDisplayState() {
    return {
      session_type: this.sessionType,
      remaining_seconds: this.remainingSeconds,
      is_running: this._status === "running",
      completed_work_sessions_in_cycle: this.completedWorkSessionsInCycle,
    };
  }
}
