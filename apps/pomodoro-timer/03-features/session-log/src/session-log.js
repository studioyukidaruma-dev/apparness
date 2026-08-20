// session-log.js
// この機能の公開エントリポイント。integrator は他機能の実装を知らなくても、
// この SessionLog クラスだけを使って結線できる。
//
//   const sessionLog = createSessionLog();
//   sessionLog.subscribe((summary, error) => { ...UIを更新... });
//   // timer-core から work_session_completed を受け取るたびに呼ぶ
//   sessionLog.onWorkSessionCompleted(event);
//   // この機能内の「全件クリア」ボタン押下時に呼ぶ
//   sessionLog.clearAll();

import { addRecord, clearRecords, computeSummary } from "./session-store.js";
import { loadRecords, saveRecords } from "./storage.js";

export class SessionLog {
  /**
   * @param {{ storage?: Storage }} [options] storage はテスト・integrator側での差し替え用
   */
  constructor(options = {}) {
    this._storage = options.storage;
    this._listeners = new Set();

    const loaded = loadRecords(this._storage);
    this.records = loaded.records;
    this.lastError = loaded.ok ? null : loaded.error;
  }

  /**
   * timer-core からの work_session_completed イベントを受け取る。
   * 不正な入力（contract.yaml の json_schema を満たさない）は記録に追加せず、
   * 現在のサマリをそのまま返す（処理を先に進めない）。
   * @param {unknown} event
   * @returns {ReturnType<typeof computeSummary>}
   */
  onWorkSessionCompleted(event) {
    const result = addRecord(this.records, event);
    if (!result.ok) {
      return this.getSummary();
    }
    this.records = result.records;
    const saved = saveRecords(this.records, this._storage);
    this.lastError = saved.ok ? null : saved.error;
    this._emit();
    return this.getSummary();
  }

  /**
   * 全件クリアする（この機能内で完結する内部操作。他機能からは呼ばれない）。
   */
  clearAll() {
    this.records = clearRecords();
    const saved = saveRecords(this.records, this._storage);
    this.lastError = saved.ok ? null : saved.error;
    this._emit();
    return this.getSummary();
  }

  /**
   * outputs.session_summary の形でサマリを返す。
   * @param {Date} [now]
   */
  getSummary(now) {
    return computeSummary(this.records, now);
  }

  /**
   * 直近の localStorage 読み書きで発生したエラー（error_cases.STORAGE_UNAVAILABLE）。
   * 無ければ null。
   */
  getError() {
    return this.lastError;
  }

  /**
   * 記録が変化するたびに (summary, error) を受け取るリスナーを登録する。
   * @param {(summary: ReturnType<typeof computeSummary>, error: unknown) => void} listener
   * @returns {() => void} 登録解除関数
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit() {
    const summary = this.getSummary();
    for (const listener of this._listeners) {
      listener(summary, this.lastError);
    }
  }
}

/**
 * @param {{ storage?: Storage }} [options]
 */
export function createSessionLog(options) {
  return new SessionLog(options);
}
