// main.js
// この機能を単体で開いて動作確認するためのデモ用エントリポイント。
// 実際の結線（timer-core からのイベント配線）は 04-integration が行う。
// ここでは「work_session_completed 相当のイベントを注入する」ボタンで代替し、
// 記録の追加・一覧表示・全件クリアが単体で確認できるようにする。

import { createSessionLog } from "./session-log.js";
import { queryElements, bindSessionLogUI } from "./ui.js";

function main() {
  const sessionLog = createSessionLog();
  const elements = queryElements(document);
  bindSessionLogUI(sessionLog, elements);

  const simulateButton = document.querySelector("[data-simulate-completed]");
  const durationInput = document.querySelector("[data-simulate-duration]");

  simulateButton?.addEventListener("click", () => {
    const minutes = Number(durationInput?.value) || 25;
    const durationSeconds = Math.max(1, Math.round(minutes * 60));
    // work_session_completed の contract.yaml json_schema に沿ったダミーイベント。
    sessionLog.onWorkSessionCompleted({
      completed_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      session_type: "WORK",
    });
  });
}

document.addEventListener("DOMContentLoaded", main);
