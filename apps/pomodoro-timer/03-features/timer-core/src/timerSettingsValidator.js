// timer_settings の入力検証。
// contract.yaml の inputs[0] (timer_settings) の json_schema をそのまま実装したもの。
// DOM / タイマー状態から独立した純粋関数として実装し、vitest から直接テストできるようにする。

const REQUIRED_FIELDS = [
  "work_minutes",
  "short_break_minutes",
  "long_break_minutes",
  "sessions_until_long_break",
  "sound_enabled",
];

const INTEGER_RANGE_FIELDS = {
  work_minutes: { min: 1, max: 180 },
  short_break_minutes: { min: 1, max: 60 },
  long_break_minutes: { min: 1, max: 60 },
  sessions_until_long_break: { min: 1, max: 12 },
};

/**
 * @param {unknown} settings
 * @returns {{ valid: true } | { valid: false, errors: string[] }}
 */
export function validateTimerSettings(settings) {
  const errors = [];

  if (
    typeof settings !== "object" ||
    settings === null ||
    Array.isArray(settings)
  ) {
    return { valid: false, errors: ["timer_settings must be a non-null object"] };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in settings)) {
      errors.push(`missing required field: ${field}`);
    }
  }

  const allowedFields = new Set(REQUIRED_FIELDS);
  for (const key of Object.keys(settings)) {
    if (!allowedFields.has(key)) {
      errors.push(`unexpected field: ${key}`);
    }
  }

  for (const [field, { min, max }] of Object.entries(INTEGER_RANGE_FIELDS)) {
    if (!(field in settings)) continue;
    const value = settings[field];
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.push(`${field} must be an integer between ${min} and ${max}`);
    }
  }

  if ("sound_enabled" in settings && typeof settings.sound_enabled !== "boolean") {
    errors.push("sound_enabled must be a boolean");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}
