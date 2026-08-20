// session-store.js
// DOM にもストレージにも依存しない純粋関数群。
// - work_session_completed の検証
// - 記録の追加・全件クリア
// - 集計（本日件数・全件数）
//
// contract.yaml の inputs[]/outputs[] で定義された形だけを信頼の境界として扱う。
// timer-core が内部でどう動いているかは一切関知しない。

export const WORK_SESSION_TYPE = "WORK";

// RFC3339/ISO8601 の日時文字列であることを確認する正規表現。
// (例: "2026-08-20T09:30:00Z", "2026-08-20T09:30:00.123+09:00")
const ISO_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const ALLOWED_EVENT_KEYS = ["completed_at", "duration_seconds", "session_type"];

/**
 * 与えられた年月の日数を返す（うるう年を考慮する）。
 * @param {number} year
 * @param {number} month 1〜12
 */
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * ISO8601形式の文字列であることに加え、"2026-02-30" のような実在しない暦日を
 * 拒否する。Date.parse はこの種の不正な日付を寛容に丸めてしまう
 * （例: "2026-02-30" を "2026-03-02" として受理する）ため、桁の形だけでなく
 * 年月日・時分秒の値の範囲を明示的に検証する。
 * @param {string} value
 */
export function isValidIsoDateTime(value) {
  const match = ISO_DATE_TIME_RE.exec(value);
  if (!match) return false;

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23) return false;
  if (minute > 59) return false;
  if (second > 60) return false; // うるう秒を許容する

  return true;
}

/**
 * contract.yaml の work_session_completed json_schema に従って入力を検証する。
 * 他機能（timer-core）からの入力は信頼せず、ここで型・範囲・必須項目・
 * additionalProperties: false を厳密にチェックする。
 * @param {unknown} event
 * @returns {boolean}
 */
export function isValidWorkSessionCompleted(event) {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    return false;
  }

  const keys = Object.keys(event);
  // additionalProperties: false
  if (keys.some((key) => !ALLOWED_EVENT_KEYS.includes(key))) {
    return false;
  }
  // required: ["completed_at", "duration_seconds", "session_type"]
  if (!ALLOWED_EVENT_KEYS.every((key) => key in event)) {
    return false;
  }

  const { completed_at, duration_seconds, session_type } = event;

  if (typeof completed_at !== "string" || !isValidIsoDateTime(completed_at)) {
    return false;
  }
  if (
    typeof duration_seconds !== "number" ||
    !Number.isInteger(duration_seconds) ||
    duration_seconds < 1
  ) {
    return false;
  }
  if (session_type !== WORK_SESSION_TYPE) {
    return false;
  }

  return true;
}

/**
 * 検証済みの work_session_completed イベントから、永続化用の記録の形に変換する。
 * session_type は記録には残さない（休憩セッションはそもそもこのイベント自体が
 * 発生しないため、この機能の記録には常にWORKのみが含まれる＝保持する必要がない）。
 * @param {{completed_at: string, duration_seconds: number, session_type: "WORK"}} event
 */
export function toRecord(event) {
  return {
    completed_at: event.completed_at,
    duration_seconds: event.duration_seconds,
  };
}

/**
 * 記録配列に新しい work_session_completed イベントを追加した配列を返す（イミュータブル）。
 * 不正な入力は追加せず、拒否したことが呼び出し側にわかるように ok: false を返す。
 * @param {Array<{completed_at: string, duration_seconds: number}>} records
 * @param {unknown} event
 */
export function addRecord(records, event) {
  if (!isValidWorkSessionCompleted(event)) {
    return { ok: false, records, reason: "invalid_work_session_completed" };
  }
  return { ok: true, records: [...records, toRecord(event)] };
}

/**
 * 全件クリアした空配列を返す。
 */
export function clearRecords() {
  return [];
}

/**
 * completed_at（ISO日時文字列）が referenceDate と同じ「ローカルの暦日」かどうかを判定する。
 * @param {string} isoString
 * @param {Date} referenceDate
 */
export function isSameLocalDay(isoString, referenceDate) {
  const d = new Date(isoString);
  return (
    d.getFullYear() === referenceDate.getFullYear() &&
    d.getMonth() === referenceDate.getMonth() &&
    d.getDate() === referenceDate.getDate()
  );
}

/**
 * 記録一覧から画面表示用のサマリ（outputs.session_summary）を組み立てる。
 * records は completed_at の新しい順に並べ替えて返す（表示用）。
 * @param {Array<{completed_at: string, duration_seconds: number}>} records
 * @param {Date} [now]
 */
export function computeSummary(records, now = new Date()) {
  const sorted = [...records].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
  );
  return {
    total_count: records.length,
    today_count: records.filter((record) => isSameLocalDay(record.completed_at, now)).length,
    records: sorted,
  };
}
