// 設定フォーム入力の範囲検証ロジック（純粋関数）。
// contract.yaml の outputs[0].json_schema / error_cases[0] に対応する。
// DOM や localStorage には一切依存しない。

export const LIMITS = Object.freeze({
  work_minutes: { min: 1, max: 180 },
  short_break_minutes: { min: 1, max: 60 },
  long_break_minutes: { min: 1, max: 60 },
  sessions_until_long_break: { min: 1, max: 12 },
});

export const DEFAULT_SETTINGS = Object.freeze({
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  sessions_until_long_break: 4,
  sound_enabled: true,
});

const REQUIRED_FIELDS = [
  "work_minutes",
  "short_break_minutes",
  "long_break_minutes",
  "sessions_until_long_break",
  "sound_enabled",
];

/**
 * 値が「安全な整数」かどうかを判定する。
 * 文字列("25")や小数(25.5)、NaN、Infinity はすべて不正として扱う。
 */
function isPlainInteger(value) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

/**
 * 設定フォームの生入力（settings_form_input）を検証し、
 * 正規化済みの timer_settings 形状、またはエラー詳細を返す。
 *
 * @param {unknown} input
 * @returns {{ valid: true, value: object } | { valid: false, errors: Array<{ field: string, reason: string }> }}
 */
export function validateSettingsInput(input) {
  const errors = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      valid: false,
      errors: [{ field: "_root", reason: "入力はオブジェクトである必要があります" }],
    };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in input)) {
      errors.push({ field, reason: "必須項目が指定されていません" });
    }
  }

  for (const [field, { min, max }] of Object.entries(LIMITS)) {
    if (!(field in input)) continue;
    const value = input[field];
    if (!isPlainInteger(value)) {
      errors.push({ field, reason: "整数である必要があります" });
      continue;
    }
    if (value < min || value > max) {
      errors.push({ field, reason: `${min}以上${max}以下である必要があります` });
    }
  }

  if ("sound_enabled" in input && typeof input.sound_enabled !== "boolean") {
    errors.push({ field: "sound_enabled", reason: "真偽値である必要があります" });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      work_minutes: input.work_minutes,
      short_break_minutes: input.short_break_minutes,
      long_break_minutes: input.long_break_minutes,
      sessions_until_long_break: input.sessions_until_long_break,
      sound_enabled: input.sound_enabled,
    },
  };
}
