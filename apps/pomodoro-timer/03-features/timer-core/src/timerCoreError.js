// contract.yaml の error_cases[] に対応するエラー型。
// スタックトレースや内部実装詳細を外部に漏らさないよう、code と最小限の詳細だけを保持する
// (security-baseline.md 5節)。

export class TimerCoreError extends Error {
  /**
   * @param {"INVALID_SETTINGS"} code
   * @param {string[]} [details]
   */
  constructor(code, details = []) {
    super(`timer-core error: ${code}`);
    this.name = "TimerCoreError";
    this.code = code;
    this.details = details;
  }

  /** error_cases[].response_shape ({ type: object }) に沿った公開用の形にする */
  toResponse() {
    return { code: this.code, details: this.details };
  }
}
