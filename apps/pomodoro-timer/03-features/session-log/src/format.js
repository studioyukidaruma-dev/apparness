// format.js
// 画面表示用のフォーマット関数（DOMに依存しない純粋関数）。

/**
 * 秒数を "mm:ss" 形式にする（例: 1500 -> "25:00"）。
 * @param {number} totalSeconds
 */
export function formatDuration(totalSeconds) {
  const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * ISO日時文字列を日本語ロケールの読みやすい表示に変換する。
 * パースできない場合は元の文字列をそのまま返す（表示を壊さないため）。
 * @param {string} isoString
 */
export function formatDateTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
