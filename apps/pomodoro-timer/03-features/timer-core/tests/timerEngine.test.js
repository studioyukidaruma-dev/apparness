import { describe, it, expect, beforeEach } from "vitest";
import {
  TimerEngine,
  SESSION_TYPES,
  computeNextSession,
  durationSecondsFor,
} from "../src/timerEngine.js";
import { TimerCoreError } from "../src/timerCoreError.js";

const baseSettings = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  sessions_until_long_break: 4,
  sound_enabled: true,
};

/** テスト用の可変クロック。 */
function makeClock(startMs = 0) {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
    set: (ms) => {
      current = ms;
    },
  };
}

describe("computeNextSession (pure function)", () => {
  it("switches WORK -> SHORT_BREAK when below the long-break threshold", () => {
    const result = computeNextSession(SESSION_TYPES.WORK, 0, 4);
    expect(result).toEqual({
      nextSessionType: SESSION_TYPES.SHORT_BREAK,
      nextCompletedCount: 1,
    });
  });

  it("switches WORK -> LONG_BREAK when reaching the threshold", () => {
    const result = computeNextSession(SESSION_TYPES.WORK, 3, 4);
    expect(result).toEqual({
      nextSessionType: SESSION_TYPES.LONG_BREAK,
      nextCompletedCount: 4,
    });
  });

  it("switches SHORT_BREAK -> WORK, keeping the cycle count", () => {
    const result = computeNextSession(SESSION_TYPES.SHORT_BREAK, 2, 4);
    expect(result).toEqual({
      nextSessionType: SESSION_TYPES.WORK,
      nextCompletedCount: 2,
    });
  });

  it("switches LONG_BREAK -> WORK, resetting the cycle count to 0", () => {
    const result = computeNextSession(SESSION_TYPES.LONG_BREAK, 4, 4);
    expect(result).toEqual({
      nextSessionType: SESSION_TYPES.WORK,
      nextCompletedCount: 0,
    });
  });
});

describe("durationSecondsFor", () => {
  it("converts minutes to seconds per session type", () => {
    expect(durationSecondsFor(SESSION_TYPES.WORK, baseSettings)).toBe(1500);
    expect(durationSecondsFor(SESSION_TYPES.SHORT_BREAK, baseSettings)).toBe(300);
    expect(durationSecondsFor(SESSION_TYPES.LONG_BREAK, baseSettings)).toBe(900);
  });
});

describe("TimerEngine construction & validation", () => {
  it("throws TimerCoreError(INVALID_SETTINGS) for missing fields", () => {
    expect(() => new TimerEngine({ work_minutes: 25 })).toThrow(TimerCoreError);
  });

  it("throws TimerCoreError(INVALID_SETTINGS) for out-of-range values", () => {
    expect(
      () => new TimerEngine({ ...baseSettings, work_minutes: 999 }),
    ).toThrow(TimerCoreError);
  });

  it("initializes to idle WORK session with full duration and zero cycle count", () => {
    const clock = makeClock();
    const engine = new TimerEngine(baseSettings, { now: clock.now });
    expect(engine.getDisplayState()).toEqual({
      session_type: "WORK",
      remaining_seconds: 1500,
      is_running: false,
      completed_work_sessions_in_cycle: 0,
    });
  });
});

describe("TimerEngine command handling", () => {
  let clock;
  let engine;

  beforeEach(() => {
    clock = makeClock(0);
    engine = new TimerEngine(baseSettings, { now: clock.now });
  });

  it("start begins running from idle", () => {
    const result = engine.handleCommand("start");
    expect(result.accepted).toBe(true);
    expect(engine.getDisplayState().is_running).toBe(true);
  });

  it("ignores start while already running (COMMAND_IGNORED)", () => {
    engine.handleCommand("start");
    const result = engine.handleCommand("start");
    expect(result.accepted).toBe(false);
    expect(engine.getDisplayState().is_running).toBe(true);
  });

  it("ignores pause while idle (COMMAND_IGNORED)", () => {
    const result = engine.handleCommand("pause");
    expect(result.accepted).toBe(false);
    expect(engine.getDisplayState().is_running).toBe(false);
  });

  it("ignores resume while already running (COMMAND_IGNORED)", () => {
    engine.handleCommand("start");
    const result = engine.handleCommand("resume");
    expect(result.accepted).toBe(false);
  });

  it("ignores resume while idle (never started)", () => {
    const result = engine.handleCommand("resume");
    expect(result.accepted).toBe(false);
  });

  it("pause freezes remaining_seconds, resume continues from there", () => {
    engine.handleCommand("start");
    clock.advance(10_000); // 10s elapsed
    engine.handleCommand("pause");
    expect(engine.getDisplayState()).toMatchObject({
      remaining_seconds: 1490,
      is_running: false,
    });

    // 一時停止中は時間が進んでも remaining は変わらない
    clock.advance(60_000);
    expect(engine.tick()).toMatchObject({ remaining_seconds: 1490, is_running: false });

    engine.handleCommand("resume");
    expect(engine.getDisplayState().is_running).toBe(true);
    clock.advance(5_000);
    expect(engine.tick().remaining_seconds).toBe(1485);
  });

  it("reset returns to idle with full duration for the current session type", () => {
    engine.handleCommand("start");
    clock.advance(100_000);
    engine.handleCommand("reset");
    expect(engine.getDisplayState()).toEqual({
      session_type: "WORK",
      remaining_seconds: 1500,
      is_running: false,
      completed_work_sessions_in_cycle: 0,
    });
  });

  it("ignores unknown command strings without throwing", () => {
    expect(() => engine.handleCommand("fast-forward")).not.toThrow();
    expect(engine.handleCommand("fast-forward").accepted).toBe(false);
  });

  it("does not lose a work_session_completed event when reset is pressed after the session already elapsed but before any tick() ran", () => {
    // バックグラウンドタブでのtimerスロットリング等により、実時間ではセッションが
    // 完了しているのに tick() がまだ一度も呼ばれていない状態を再現する。
    const completedEvents = [];
    engine.on("workSessionCompleted", (payload) => completedEvents.push(payload));

    engine.handleCommand("start");
    clock.advance(1500 * 1000); // WORK 25分ちょうど経過（tick()はまだ呼んでいない）
    engine.handleCommand("reset"); // tick()を挟まずに直接reset

    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].session_type).toBe("WORK");
    // 完了したWORKの次はSHORT_BREAKへ進んでおり、そのセッションがリセットされている
    expect(engine.getDisplayState()).toEqual({
      session_type: "SHORT_BREAK",
      remaining_seconds: 300,
      is_running: false,
      completed_work_sessions_in_cycle: 1,
    });
  });
});

describe("TimerEngine countdown precision", () => {
  it("recomputes remaining_seconds from elapsed time rather than decrementing per tick", () => {
    const clock = makeClock(0);
    const engine = new TimerEngine(baseSettings, { now: clock.now });
    engine.handleCommand("start");

    // 多数回の細かいtickでも、経過時間の合計だけが結果を決める
    // (setIntervalのコールバック間隔そのものの誤差は蓄積しない)
    for (let i = 0; i < 37; i++) {
      clock.advance(270); // 270ms x 37 = 9990ms 経過
      engine.tick();
    }
    // 9990ms 経過 = 開始時刻からの差分は 1490010ms -> ceil(1490010/1000) = 1491
    const state = engine.tick(clock.now());
    expect(state.remaining_seconds).toBe(1491);
  });
});

describe("TimerEngine session auto-switching", () => {
  it("emits work_session_completed exactly once when a WORK session finishes, then switches to SHORT_BREAK", () => {
    const clock = makeClock(1_700_000_000_000); // 任意の基準時刻
    const engine = new TimerEngine(baseSettings, { now: clock.now });

    const completedEvents = [];
    engine.on("workSessionCompleted", (payload) => completedEvents.push(payload));

    engine.handleCommand("start");
    clock.advance(1500 * 1000); // WORK 25分ちょうど経過
    const state = engine.tick();

    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0]).toEqual({
      completed_at: new Date(1_700_000_000_000 + 1500 * 1000).toISOString(),
      duration_seconds: 1500,
      session_type: "WORK",
    });

    expect(state).toEqual({
      session_type: "SHORT_BREAK",
      remaining_seconds: 300,
      is_running: true,
      completed_work_sessions_in_cycle: 1,
    });
  });

  it("does not emit work_session_completed when a break session finishes", () => {
    const clock = makeClock(0);
    const engine = new TimerEngine(baseSettings, { now: clock.now });
    const completedEvents = [];
    engine.on("workSessionCompleted", (payload) => completedEvents.push(payload));

    engine.handleCommand("start");
    clock.advance(1500 * 1000); // WORK 完了 -> SHORT_BREAK
    engine.tick();
    expect(completedEvents).toHaveLength(1);

    clock.advance(300 * 1000); // SHORT_BREAK 完了 -> WORK
    const state = engine.tick();
    expect(completedEvents).toHaveLength(1); // 休憩完了では増えない
    expect(state.session_type).toBe("WORK");
    expect(state.completed_work_sessions_in_cycle).toBe(1);
  });

  it("switches to LONG_BREAK after sessions_until_long_break work sessions, then resets the cycle count", () => {
    const settings = { ...baseSettings, sessions_until_long_break: 2 };
    const clock = makeClock(0);
    const engine = new TimerEngine(settings, { now: clock.now });

    // 1回目の WORK 完了 -> SHORT_BREAK, カウント1
    engine.handleCommand("start");
    clock.advance(1500 * 1000);
    let state = engine.tick();
    expect(state).toMatchObject({ session_type: "SHORT_BREAK", completed_work_sessions_in_cycle: 1 });

    // SHORT_BREAK 完了 -> WORK
    clock.advance(300 * 1000);
    state = engine.tick();
    expect(state.session_type).toBe("WORK");

    // 2回目の WORK 完了 -> しきい値到達で LONG_BREAK
    clock.advance(1500 * 1000);
    state = engine.tick();
    expect(state).toMatchObject({ session_type: "LONG_BREAK", completed_work_sessions_in_cycle: 2 });

    // LONG_BREAK 完了 -> WORK に戻り、カウントは0にリセット
    clock.advance(900 * 1000);
    state = engine.tick();
    expect(state).toMatchObject({ session_type: "WORK", completed_work_sessions_in_cycle: 0 });
  });

  it("handles large time jumps by chaining multiple auto-transitions in a single tick", () => {
    const settings = { ...baseSettings, sessions_until_long_break: 2 };
    const clock = makeClock(0);
    const engine = new TimerEngine(settings, { now: clock.now });
    const completedEvents = [];
    engine.on("workSessionCompleted", (payload) => completedEvents.push(payload));

    engine.handleCommand("start");
    // WORK(1500) + SHORT_BREAK(300) + WORK(1500) = 3300s でLONG_BREAKに入り、
    // さらに 100s 経過した状態まで一気にジャンプする
    clock.advance((1500 + 300 + 1500 + 100) * 1000);
    const state = engine.tick();

    expect(completedEvents).toHaveLength(2); // WORKセッションは2回完了
    expect(state).toEqual({
      session_type: "LONG_BREAK",
      remaining_seconds: 900 - 100,
      is_running: true,
      completed_work_sessions_in_cycle: 2,
    });
  });
});

describe("TimerEngine settings reload timing", () => {
  it("does not apply updated settings to the currently running session", () => {
    const clock = makeClock(0);
    const engine = new TimerEngine(baseSettings, { now: clock.now });
    engine.handleCommand("start");
    clock.advance(10_000);

    engine.updateSettings({ ...baseSettings, work_minutes: 1 }); // 進行中には反映されない
    expect(engine.tick().remaining_seconds).toBe(1490);
  });

  it("applies updated settings the next time a session starts", () => {
    const clock = makeClock(0);
    const engine = new TimerEngine(baseSettings, { now: clock.now });
    engine.updateSettings({ ...baseSettings, work_minutes: 1 });
    engine.handleCommand("start");
    expect(engine.getDisplayState().remaining_seconds).toBe(60);
  });

  it("applies updated settings on reset", () => {
    const clock = makeClock(0);
    const engine = new TimerEngine(baseSettings, { now: clock.now });
    engine.handleCommand("start");
    engine.updateSettings({ ...baseSettings, work_minutes: 10 });
    engine.handleCommand("reset");
    expect(engine.getDisplayState().remaining_seconds).toBe(600);
  });

  it("applies updated settings at the next automatic session switch", () => {
    const clock = makeClock(0);
    const engine = new TimerEngine(baseSettings, { now: clock.now });
    engine.handleCommand("start");
    clock.advance(1500 * 1000); // WORK完了、SHORT_BREAKへ
    // WORK完了と同じ瞬間に短い休憩の設定を変える
    engine.updateSettings({ ...baseSettings, short_break_minutes: 1 });
    const state = engine.tick();
    expect(state).toMatchObject({ session_type: "SHORT_BREAK", remaining_seconds: 60 });
  });

  it("throws and keeps the previous pending settings when updateSettings receives invalid input", () => {
    const clock = makeClock(0);
    const engine = new TimerEngine(baseSettings, { now: clock.now });
    expect(() => engine.updateSettings({ ...baseSettings, work_minutes: -1 })).toThrow(
      TimerCoreError,
    );
    engine.handleCommand("reset");
    expect(engine.getDisplayState().remaining_seconds).toBe(1500); // 元の設定のまま
  });
});
