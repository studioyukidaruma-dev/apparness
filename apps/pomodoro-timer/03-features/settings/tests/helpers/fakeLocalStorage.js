// テスト用の最小限の localStorage 実装（Node環境には localStorage が無いため）。
export function createFakeLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

/**
 * setItem が常に例外を投げる localStorage（書き込み不可な環境を模す）。
 * probe（storage.js の可用性チェック）は許可するため、STORAGE_KEY への
 * 書き込みだけを失敗させる。
 */
export function createWriteFailingLocalStorage(realKeyToFail) {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (key === realKeyToFail) {
        throw new DOMException("QuotaExceededError");
      }
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}
