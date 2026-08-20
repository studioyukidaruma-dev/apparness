// localStorage への読み書きを閉じ込めるモジュール。
// shared-kernel.yaml の data_store.policy に従い、キーは
// `pomodoro-timer:<domain>:v<n>` の形式、値は JSON.stringify した文字列。

import { DEFAULT_SETTINGS, validateSettingsInput } from "./validate.js";

export const STORAGE_KEY = "pomodoro-timer:settings:v1";

/**
 * localStorage が利用可能かどうかを確認する（プライベートブラウジング等で
 * 例外を投げる環境があるため、実際に読み書きして確認する）。
 */
function getStorage() {
  try {
    if (typeof localStorage === "undefined") return null;
    const probeKey = "__pomodoro-timer_storage_probe__";
    localStorage.setItem(probeKey, "1");
    localStorage.removeItem(probeKey);
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * 保存済みの設定値を読み込む。存在しない・壊れている・localStorage が
 * 利用不可の場合はいずれも既定値にフォールバックする（例外を投げない）。
 *
 * @returns {object} timer_settings 形状のオブジェクト
 */
export function loadSettings() {
  const storage = getStorage();
  if (!storage) {
    return { ...DEFAULT_SETTINGS };
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    return { ...DEFAULT_SETTINGS };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }

  const validation = validateSettingsInput(parsed);
  if (!validation.valid) {
    return { ...DEFAULT_SETTINGS };
  }
  return validation.value;
}

/**
 * 検証済みの設定値を保存する。呼び出し側で validateSettingsInput 済みの
 * 値を渡すこと（このモジュールは保存の成否のみを扱う）。
 *
 * @param {object} settings
 * @returns {{ ok: true } | { ok: false, error: { code: "STORAGE_UNAVAILABLE", message: string } }}
 */
export function persistSettings(settings) {
  const storage = getStorage();
  if (!storage) {
    return {
      ok: false,
      error: { code: "STORAGE_UNAVAILABLE", message: "localStorage が利用できません" },
    };
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: { code: "STORAGE_UNAVAILABLE", message: "localStorage への書き込みに失敗しました" },
    };
  }
}
