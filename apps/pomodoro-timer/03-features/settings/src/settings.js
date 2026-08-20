// settings 機能の公開 API。
// contract.yaml の inputs/outputs/error_cases を満たす唯一の入口。
// 他機能（timer-core）はこのモジュールの getSettings() が返す timer_settings
// 形状（JSON Schema）だけを信頼してよく、内部の永続化方法を知る必要はない。

import { validateSettingsInput, DEFAULT_SETTINGS } from "./validate.js";
import { loadSettings, persistSettings } from "./storage.js";

/**
 * 現在の設定値（timer_settings）を返す。
 * 未保存（初回アクセス）の場合は既定値を返す。
 *
 * @returns {object}
 */
export function getSettings() {
  return loadSettings();
}

/**
 * 設定フォームからの生入力（settings_form_input）を検証したうえで保存する。
 *
 * @param {unknown} rawInput
 * @returns {
 *   { ok: true, value: object } |
 *   { ok: false, error: { code: "INVALID_INPUT", message: string, details: Array } } |
 *   { ok: false, error: { code: "STORAGE_UNAVAILABLE", message: string } }
 * }
 */
export function saveSettings(rawInput) {
  const validation = validateSettingsInput(rawInput);
  if (!validation.valid) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "入力値が範囲外、または不正な形式です",
        details: validation.errors,
      },
    };
  }

  const persistResult = persistSettings(validation.value);
  if (!persistResult.ok) {
    return { ok: false, error: persistResult.error };
  }

  return { ok: true, value: validation.value };
}

export { DEFAULT_SETTINGS };
