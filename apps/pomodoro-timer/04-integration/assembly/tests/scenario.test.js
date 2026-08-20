// 主要なユーザーシナリオを、実際の index.html のマークアップ + bootstrapApp() を通しで
// 検証するE2Eレベルの結合テスト。
//
// シナリオ: 設定タブで作業時間を変更して保存する -> タイマータブで開始する ->
//           作業セッションが完了する -> セッション記録タブに1件増えて表示される。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapApp } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtmlSource = readFileSync(path.join(__dirname, "../index.html"), "utf-8");

/** index.html の <body> 内容(結線用の <script type="module"> を除く)をそのまま流用する。 */
function mountAssemblyMarkup() {
  const bodyMatch = indexHtmlSource.match(/<body>([\s\S]*)<\/body>/);
  if (!bodyMatch) {
    throw new Error("index.html から <body> を抽出できませんでした");
  }
  const bodyWithoutScript = bodyMatch[1].replace(/<script[\s\S]*?<\/script>\s*$/, "");
  document.body.innerHTML = bodyWithoutScript;
}

describe("pomodoro-timer 統合シナリオ", () => {
  let stop;

  beforeEach(() => {
    localStorage.clear();
    mountAssemblyMarkup();
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.useRealTimers();
  });

  it("設定変更→タイマー開始→作業完了→セッション記録、という一連の操作が通しで動く", () => {
    // mountTimerUI が起動時に setInterval を登録するため、マウント前にfake timersへ切り替える。
    vi.useFakeTimers();

    const { sessionLog, stop: stopFn } = bootstrapApp(document);
    stop = stopFn;

    // 1. 設定タブに切り替え、作業時間を1分に変更して保存する(settings機能自身のUIをそのまま操作)
    document.getElementById("tab-settings").click();
    document.getElementById("settings-work_minutes").value = "1";
    document.getElementById("settings-short_break_minutes").value = "1";
    document.getElementById("settings-long_break_minutes").value = "1";
    document.getElementById("settings-sessions_until_long_break").value = "4";
    document.getElementById("settings-sound_enabled").checked = false;
    document.querySelector(".settings-submit").click();
    expect(document.querySelector(".settings-status--success")).not.toBeNull();

    // 2. タイマータブに戻って開始する
    document.getElementById("tab-timer").click();
    document.getElementById("timer-start").click();

    // interfaces[0]: 保存した設定(1分)が実際にtimer-coreへ反映されていること
    expect(document.getElementById("timer-remaining").textContent).toBe("01:00");
    expect(document.getElementById("timer-start").disabled).toBe(true);

    // 3. 作業セッションが完了するまで実時間を進める(内部のsetInterval(render,250)経由)
    vi.advanceTimersByTime(61_000);

    // interfaces[1]: work_session_completed がsession-logに届いていること
    document.getElementById("tab-session-log").click();
    expect(document.querySelector("[data-session-log-total-count]").textContent).toBe("1");
    expect(document.querySelector("[data-session-log-today-count]").textContent).toBe("1");
    expect(document.querySelectorAll(".session-log__item").length).toBe(1);

    const summary = sessionLog.getSummary();
    expect(summary.total_count).toBe(1);
    expect(summary.records[0].duration_seconds).toBe(60);

    // 4. 全件クリアも操作できる(session-log機能内で完結する操作)
    vi.stubGlobal("confirm", () => true);
    document.querySelector("[data-session-log-clear]").click();
    expect(document.querySelector("[data-session-log-total-count]").textContent).toBe("0");
    vi.unstubAllGlobals();
  });

  it("タブ切り替えで表示されるパネルが1つだけになる", () => {
    const { stop: stopFn } = bootstrapApp(document);
    stop = stopFn;

    const panels = ["panel-timer", "panel-settings", "panel-session-log"];

    document.getElementById("tab-settings").click();
    for (const id of panels) {
      const hidden = document.getElementById(id).hidden;
      expect(hidden).toBe(id !== "panel-settings");
    }

    document.getElementById("tab-session-log").click();
    for (const id of panels) {
      const hidden = document.getElementById(id).hidden;
      expect(hidden).toBe(id !== "panel-session-log");
    }
  });
});
