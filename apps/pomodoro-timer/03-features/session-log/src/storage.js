// storage.js
// localStorage への読み書きをラップするアダプタ。
// 01-foundation/shared-kernel.yaml の data_store.policy に従う:
// - キーは `pomodoro-timer:session-records:v1`
// - 値は JSON.stringify した文字列として保存する
// - localStorage が利用不可・読み書き失敗時はエラーを握りつぶさず、
//   呼び出し側がメモリ内の既定値で動作を継続できるようにする

export const STORAGE_KEY = "pomodoro-timer:session-records:v1";

/**
 * contract.yaml の error_cases[0] (STORAGE_UNAVAILABLE) の形。
 * @param {"load"|"save"} action
 */
function makeStorageError(action) {
  return {
    code: "STORAGE_UNAVAILABLE",
    message:
      action === "load"
        ? "記録の読み込みに失敗しました。ローカルストレージが利用できない可能性があります。"
        : "記録の保存に失敗しました。ローカルストレージが利用できない可能性があります。",
  };
}

/**
 * 実行環境で localStorage が使えるかどうかを安全に確認する
 * （プライベートブラウジング等で参照自体が例外を投げる場合があるため try/catch する）。
 */
function getSafeStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * 記録一覧を読み込む。失敗しても例外を投げず、空配列 + エラー情報を返す。
 * @param {Storage} [storage] テスト用に差し替え可能
 */
export function loadRecords(storage) {
  const target = getSafeStorage(storage);
  if (!target) {
    return { ok: false, records: [], error: makeStorageError("load") };
  }

  let raw;
  try {
    raw = target.getItem(STORAGE_KEY);
  } catch (err) {
    // localStorage自体へのアクセスが失敗したケース（プライベートブラウジング等）。
    console.warn("[session-log] localStorageの読み込みに失敗しました", err);
    return { ok: false, records: [], error: makeStorageError("load") };
  }

  if (raw === null) {
    return { ok: true, records: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      // 壊れたデータは既定値（空配列）にフォールバックする（マイグレーション処理は持たない方針）。
      return { ok: true, records: [] };
    }
    return { ok: true, records: parsed };
  } catch (err) {
    // ストレージへのアクセス自体は成功しているが、保存されていた値が壊れている（不正なJSON）ケース。
    // STORAGE_UNAVAILABLE（読み書き失敗）とは原因が異なるため、ここではエラーとして報告せず、
    // data_store.policy の「マイグレーション処理は持たない」方針に従い既定値へフォールバックする。
    console.warn(
      "[session-log] 保存されていた記録データの形式が不正なため、既定値にフォールバックします",
      err,
    );
    return { ok: true, records: [] };
  }
}

/**
 * 記録一覧を保存する。
 * @param {Array<{completed_at: string, duration_seconds: number}>} records
 * @param {Storage} [storage] テスト用に差し替え可能
 */
export function saveRecords(records, storage) {
  const target = getSafeStorage(storage);
  if (!target) {
    return { ok: false, error: makeStorageError("save") };
  }
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(records));
    return { ok: true };
  } catch (err) {
    console.warn("[session-log] localStorageへの保存に失敗しました", err);
    return { ok: false, error: makeStorageError("save") };
  }
}
