// ui.js
// DOM への描画とイベント配線。ロジックは session-log.js / session-store.js に委譲し、
// ここでは「DOM要素 <-> SessionLogの状態」の橋渡しだけを行う。
// XSS対策として innerHTML への直接代入は行わず、textContent / createElement のみを使う
// （security-baseline.md 1節）。

import { formatDuration, formatDateTime } from "./format.js";

/**
 * @typedef {{
 *   totalCount: HTMLElement,
 *   todayCount: HTMLElement,
 *   recordsList: HTMLElement,
 *   storageError: HTMLElement,
 *   clearButton: HTMLButtonElement,
 * }} SessionLogElements
 */

/**
 * document から必要な要素を集める。
 * @param {ParentNode} root
 * @returns {SessionLogElements}
 */
export function queryElements(root = document) {
  return {
    totalCount: root.querySelector("[data-session-log-total-count]"),
    todayCount: root.querySelector("[data-session-log-today-count]"),
    recordsList: root.querySelector("[data-session-log-records]"),
    storageError: root.querySelector("[data-session-log-storage-error]"),
    clearButton: root.querySelector("[data-session-log-clear]"),
  };
}

/**
 * サマリを元にDOMを再描画する。
 * @param {SessionLogElements} elements
 * @param {{ total_count: number, today_count: number, records: Array<{completed_at: string, duration_seconds: number}> }} summary
 * @param {{ code: string, message: string } | null} error
 */
export function renderSummary(elements, summary, error) {
  elements.totalCount.textContent = String(summary.total_count);
  elements.todayCount.textContent = String(summary.today_count);

  while (elements.recordsList.firstChild) {
    elements.recordsList.removeChild(elements.recordsList.firstChild);
  }

  if (summary.records.length === 0) {
    const empty = document.createElement("li");
    empty.className = "session-log__empty";
    empty.textContent = "まだ記録がありません。作業セッションが完了すると、ここに表示されます。";
    elements.recordsList.appendChild(empty);
  } else {
    for (const record of summary.records) {
      const item = document.createElement("li");
      item.className = "session-log__item";

      const time = document.createElement("span");
      time.className = "session-log__item-time";
      time.textContent = formatDateTime(record.completed_at);

      const duration = document.createElement("span");
      duration.className = "session-log__item-duration";
      duration.textContent = formatDuration(record.duration_seconds);
      duration.setAttribute("aria-label", `所要時間 ${formatDuration(record.duration_seconds)}`);

      item.append(time, duration);
      elements.recordsList.appendChild(item);
    }
  }

  if (error) {
    elements.storageError.hidden = false;
    elements.storageError.textContent = error.message;
  } else {
    elements.storageError.hidden = true;
    elements.storageError.textContent = "";
  }

  elements.clearButton.disabled = summary.records.length === 0;
}

/**
 * SessionLog インスタンスと DOM を結線する。
 * @param {import("./session-log.js").SessionLog} sessionLog
 * @param {SessionLogElements} elements
 */
export function bindSessionLogUI(sessionLog, elements) {
  const render = () => renderSummary(elements, sessionLog.getSummary(), sessionLog.getError());

  elements.clearButton.addEventListener("click", () => {
    const hasRecords = sessionLog.getSummary().records.length > 0;
    if (!hasRecords) return;
    const confirmed = window.confirm("すべての記録を削除します。よろしいですか？");
    if (!confirmed) return;
    sessionLog.clearAll();
  });

  const unsubscribe = sessionLog.subscribe(() => render());
  render();

  return unsubscribe;
}
