// 設定フォームの DOM 結線。
// getSettings()/saveSettings() 以外の内部実装（validate.js/storage.js）には
// 依存させず、settings.js の公開 API だけを使う。

import { getSettings, saveSettings } from "./settings.js";

const FIELD_DEFS = [
  { key: "work_minutes", label: "作業時間（分）", type: "number", min: 1, max: 180 },
  { key: "short_break_minutes", label: "短い休憩時間（分）", type: "number", min: 1, max: 60 },
  { key: "long_break_minutes", label: "長い休憩時間（分）", type: "number", min: 1, max: 60 },
  {
    key: "sessions_until_long_break",
    label: "長い休憩までの作業セッション数",
    type: "number",
    min: 1,
    max: 12,
  },
  { key: "sound_enabled", label: "通知音を有効にする", type: "checkbox" },
];

/**
 * 指定したコンテナ要素に設定フォームをマウントする。
 * @param {HTMLElement} container
 */
export function mountSettingsForm(container) {
  container.innerHTML = "";

  const form = document.createElement("form");
  form.className = "settings-form";
  form.noValidate = true;

  const fieldsEl = {};

  for (const def of FIELD_DEFS) {
    const row = document.createElement("div");
    row.className = "settings-field";

    const label = document.createElement("label");
    label.textContent = def.label;
    label.htmlFor = `settings-${def.key}`;

    const input = document.createElement("input");
    input.id = `settings-${def.key}`;
    input.name = def.key;
    input.type = def.type;
    if (def.type === "number") {
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = "1";
      input.inputMode = "numeric";
    }

    const errorEl = document.createElement("p");
    errorEl.className = "settings-field-error";
    errorEl.setAttribute("role", "alert");
    errorEl.hidden = true;

    if (def.type === "checkbox") {
      row.classList.add("settings-field--checkbox");
      row.append(input, label, errorEl);
    } else {
      row.append(label, input, errorEl);
    }

    form.appendChild(row);
    fieldsEl[def.key] = { input, errorEl };
  }

  const statusEl = document.createElement("p");
  statusEl.className = "settings-status";
  statusEl.setAttribute("role", "status");
  statusEl.hidden = true;

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "settings-submit";
  submitButton.textContent = "保存";

  form.append(submitButton, statusEl);
  container.appendChild(form);

  function fillFormFromSettings(settings) {
    for (const def of FIELD_DEFS) {
      const { input } = fieldsEl[def.key];
      if (def.type === "checkbox") {
        input.checked = Boolean(settings[def.key]);
      } else {
        input.value = String(settings[def.key]);
      }
    }
  }

  function clearErrors() {
    for (const def of FIELD_DEFS) {
      const { input, errorEl } = fieldsEl[def.key];
      input.setAttribute("aria-invalid", "false");
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  }

  function readFormInput() {
    const raw = {};
    for (const def of FIELD_DEFS) {
      const { input } = fieldsEl[def.key];
      if (def.type === "checkbox") {
        raw[def.key] = input.checked;
      } else {
        // 数値化できない入力（空欄・小数点付き文字列等）はそのまま渡し、
        // 検証ロジック（validate.js）側で INVALID_INPUT として弾く。
        raw[def.key] = input.value === "" ? NaN : Number(input.value);
      }
    }
    return raw;
  }

  function showStatus(message, isError) {
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle("settings-status--error", Boolean(isError));
    statusEl.classList.toggle("settings-status--success", !isError);
  }

  function showFieldErrors(details) {
    for (const { field, reason } of details) {
      const target = fieldsEl[field];
      if (!target) continue;
      target.input.setAttribute("aria-invalid", "true");
      target.errorEl.hidden = false;
      target.errorEl.textContent = reason;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors();

    const result = saveSettings(readFormInput());
    if (!result.ok) {
      if (result.error.code === "INVALID_INPUT") {
        showFieldErrors(result.error.details);
        showStatus("入力値を確認してください。", true);
      } else {
        showStatus("保存に失敗しました（ストレージが利用できません）。", true);
      }
      return;
    }

    fillFormFromSettings(result.value);
    showStatus("設定を保存しました。", false);
  });

  fillFormFromSettings(getSettings());

  return { form, fieldsEl };
}
