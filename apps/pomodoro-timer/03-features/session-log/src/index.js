// index.js
// integrator 向けの公開エントリポイント（バレルファイル）。
// この機能の外から使ってよいのはここに export されたものだけ、という目印。

export { SessionLog, createSessionLog } from "./session-log.js";
export {
  isValidWorkSessionCompleted,
  isValidIsoDateTime,
  addRecord,
  clearRecords,
  computeSummary,
} from "./session-store.js";
export { queryElements, renderSummary, bindSessionLogUI } from "./ui.js";
export { formatDuration, formatDateTime } from "./format.js";
