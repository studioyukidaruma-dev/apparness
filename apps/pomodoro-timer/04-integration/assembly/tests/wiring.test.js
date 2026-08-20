// architecture.machine.yaml の interfaces[] が実際に機能することを検証する結合テスト。
//
//   interfaces[0]: settings.timer_settings          -> timer-core.timer_settings
//   interfaces[1]: timer-core.work_session_completed -> session-log.work_session_completed
//
// 各機能の内部実装（DOM構造・状態管理・永続化方法）には立ち入らず、公開APIだけを使う。

import { beforeEach, describe, expect, it } from "vitest";
import { TimerEngine } from "../../../03-features/timer-core/src/timerEngine.js";
import { getSettings, saveSettings } from "../../../03-features/settings/src/settings.js";
import { createSessionLog } from "../../../03-features/session-log/src/index.js";
import {
  pushLatestSettingsToTimer,
  wireWorkSessionCompletedToSessionLog,
} from "../src/app.js";

beforeEach(() => {
  localStorage.clear();
});

describe("interfaces[0]: settings.timer_settings -> timer-core.timer_settings", () => {
  it("settingsで保存した値がtimer-coreの次回セッション開始時に反映される", () => {
    const engine = new TimerEngine(getSettings()); // 起動時点は既定値(25分)

    const saved = saveSettings({
      work_minutes: 1,
      short_break_minutes: 2,
      long_break_minutes: 3,
      sessions_until_long_break: 4,
      sound_enabled: false,
    });
    expect(saved.ok).toBe(true);

    // 進行中でないので、保存しただけではまだ反映されない(contract.yaml通り)
    expect(engine.getDisplayState().remaining_seconds).toBe(25 * 60);

    pushLatestSettingsToTimer(engine);
    engine.handleCommand("start");

    expect(engine.getDisplayState().remaining_seconds).toBe(1 * 60);
  });

  it("不正な入力は保存されず、timer-coreには直前の値が渡り続ける", () => {
    saveSettings({
      work_minutes: 10,
      short_break_minutes: 2,
      long_break_minutes: 3,
      sessions_until_long_break: 4,
      sound_enabled: false,
    });
    const engine = new TimerEngine(getSettings());

    const rejected = saveSettings({
      work_minutes: 999, // 上限(180)超え -> INVALID_INPUT
      short_break_minutes: 2,
      long_break_minutes: 3,
      sessions_until_long_break: 4,
      sound_enabled: false,
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.error.code).toBe("INVALID_INPUT");

    // 拒否された入力はtimer-core側に一切伝わらない
    expect(() => pushLatestSettingsToTimer(engine)).not.toThrow();
    engine.handleCommand("start");
    expect(engine.getDisplayState().remaining_seconds).toBe(10 * 60);
  });
});

describe("interfaces[1]: timer-core.work_session_completed -> session-log.work_session_completed", () => {
  it("作業セッション完了イベントがそのままsession-logの記録に1件追加される", () => {
    const engine = new TimerEngine({
      work_minutes: 1,
      short_break_minutes: 1,
      long_break_minutes: 1,
      sessions_until_long_break: 4,
      sound_enabled: false,
    });
    const sessionLog = createSessionLog();
    wireWorkSessionCompletedToSessionLog(engine, sessionLog);

    expect(sessionLog.getSummary().total_count).toBe(0);

    engine.handleCommand("start");
    const future = Date.now() + 61_000; // 1分(=work_minutes)経過させる
    engine.tick(future);

    const summary = sessionLog.getSummary();
    expect(summary.total_count).toBe(1);
    expect(summary.records[0].duration_seconds).toBe(60);
  });

  it("休憩セッション完了ではsession-logに記録が増えない(work_session_completedが発火しないため)", () => {
    const engine = new TimerEngine({
      work_minutes: 1,
      short_break_minutes: 1,
      long_break_minutes: 1,
      sessions_until_long_break: 4,
      sound_enabled: false,
    });
    const sessionLog = createSessionLog();
    wireWorkSessionCompletedToSessionLog(engine, sessionLog);

    engine.handleCommand("start");
    let future = Date.now() + 61_000; // 作業セッション完了 -> SHORT_BREAKへ自動切替
    engine.tick(future);
    expect(sessionLog.getSummary().total_count).toBe(1);

    future += 61_000; // 短い休憩も完了させる
    engine.tick(future);
    expect(engine.getDisplayState().session_type).toBe("WORK");
    expect(sessionLog.getSummary().total_count).toBe(1); // 増えていないこと
  });
});
