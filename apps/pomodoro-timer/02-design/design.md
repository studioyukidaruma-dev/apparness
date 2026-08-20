# 設計書: ポモドーロタイマー

> このファイルは人間向けです。機械向けの構造化データは `architecture.machine.yaml` と
> `features/<feature-id>.contract.yaml` を参照してください。

- app_id: `pomodoro-timer`
- design_version: 1
- based_on_requirements_version: 1
- status: APPROVED

## 全体アーキテクチャ概要

要件（FR-1 タイマー本体 / FR-2 設定 / FR-3 セッション記録）をそのまま3機能に対応させ、
`timer-core` / `settings` / `session-log` の3機能に分割した。各機能は自分専用の画面領域
（timer-coreはタイマー表示と開始/一時停止/再開/リセットボタン、settingsは設定フォーム、
session-logは記録一覧と件数表示）を持つ独立した Vanilla JS モジュールとして実装し、
04-integration で1つの静的ページに組み上げる。

つながりは以下の2本の一方向イベント/値の受け渡しのみで、`depends_on` のような直接依存は
一切持たせない。

```
settings  --(timer_settings)-->        timer-core
timer-core --(work_session_completed)--> session-log
```

- `settings` は `timer-core` がいつ・どのようにカウントダウンしているかを知らない。
  検証済みの `timer_settings` を出すだけ。
- `timer-core` は `settings` の入力フォームの見た目も、`session-log` の記録の見せ方も
  知らない。作業セッション完了時に `work_session_completed` を出すだけ。
- `session-log` は `timer-core` の内部状態（残り秒数の計算方法や一時停止中かどうか等）を
  一切知らない。完了イベントを受け取って記録するだけ。

この3機能はどの順番で作り始めても、契約（`contract.yaml` の inputs/outputs）さえ守れば
互いの実装を待たずに完成でき、結線は04-integrationでイベントの受け渡し部分を配線するだけで
成立する設計になっている。

## 共有基盤 (Shared Kernel)

全機能が依存してよい最小限の共有契約。詳細は `../01-foundation/shared-kernel.yaml`。

- `common_types`: 意図的に空。`timer_settings` や `work_session_completed` のような
  producer/consumer 間だけで使う型は、shared-kernel に複製せず各機能の `contract.yaml` と
  `architecture.machine.yaml` の `interfaces[]` だけで表現する（6節）。
- `auth`: このアプリは認証を持たない（要件の non_goals）ため空。
- `data_store`: `settings` と `session-log` が共通で必要とする「localStorageのみを使う」
  「キーは `pomodoro-timer:<domain>:v<n>` で名前空間化する」というDB方針のみを共有する。
  レコードの具体的な形は各機能が個別に定義する。
- `required_skills`: 空。UIは最低限の3画面のみで、`harness/quality/design-baseline.md`
  （Layer 1、feature-builder/integratorが実装・結線時に必ず読む）だけで最低限の品質を
  担保できると判断し、デザイン系プラグインSkill等の追加インストールは行わない。

むやみに増やさないこと（増やすほど機能の独立性が損なわれる）。

## 機能一覧 (Features)

| ID | 名前 | 概要 | 技術スタック | 契約ファイル |
|---|---|---|---|---|
| `timer-core` | タイマー本体 | 作業/短い休憩/長い休憩のカウントダウン・自動切替・開始/一時停止/再開/リセット（FR-1） | Vanilla JS (ES2022, ESM) / vitest(dev) | `features/timer-core.contract.yaml` |
| `settings` | 設定 | 作業/休憩時間・長休憩までの回数・通知音ON/OFFの編集とlocalStorage永続化（FR-2） | Vanilla JS (ES2022, ESM) / vitest(dev) | `features/settings.contract.yaml` |
| `session-log` | セッション記録 | 完了した作業セッションの記録・一覧表示・全件クリア（FR-3） | Vanilla JS (ES2022, ESM) / vitest(dev) | `features/session-log.contract.yaml` |

## 機能間のつながり (Interfaces)

| 出力元機能 | 出力 | 入力先機能 | 入力 |
|---|---|---|---|
| `settings` | `timer_settings` | `timer-core` | `timer_settings` |
| `timer-core` | `work_session_completed` | `session-log` | `work_session_completed` |

機能同士は上表の入出力接続でのみ結合する。`depends_on` のような直接依存は持たせない
（`harness/CONVENTIONS.md` 6節を参照）。

## 技術スタック選定の根拠

このアプリの制約（フロントエンドのみ・バックエンド無し・静的ファイルとしてホスティング可能）と、
「apparnessハーネスの機能分割の妥当性を検証する試験用アプリ」という位置づけを踏まえ、あえて
最小構成にした。

- **言語/フレームワーク: Vanilla JavaScript（ES2022, ネイティブES Modules）、フレームワーク無し。**
  ビルドツール（バンドラ・トランスパイラ）を一切使わず、`<script type="module">` で
  ブラウザに直接読み込めるファイルだけで完結させる。理由:
  - 要件の非機能要件「静的ファイルとしてホスティング可能な構成」を最も単純な形で満たせる
    （ビルド成果物＝ソースそのもの）。
  - 3機能をそれぞれ独立したESモジュールとして実装でき、「入出力さえ合えば内部実装を知らずに
    完成できる」という検証目的に対して、フレームワーク由来の暗黙の結合（グローバルなstore・
    仮想DOM経由の暗黙的な再レンダリング等）が入り込む余地を減らせる。
  - React/Vue等の主要フレームワークは本アプリの規模（3画面・状態遷移も単純）に対して過剰と
    判断した。
- **テスト: [Vitest](https://www.npmjs.com/package/vitest)（devDependency、本番配信物には含めない）。**
  MITライセンス、2026年8月時点で直近1か月以内にリリースがあり活発にメンテナンスされている
  ことをnpmで確認済み。既知の重大な脆弱性報告なし。各機能はDOM操作から独立した純粋関数
  （カウントダウン計算・入力検証・記録集計等）を切り出し、vitestで単体テストする方針にする
  ことで、機能間の結合を作らずに個々のロジックを検証できるようにした。
  （出典: [vitest - npm](https://www.npmjs.com/package/vitest?activeTab=versions)）
- **永続化: ブラウザ標準の `localStorage`。** 追加ライブラリ無し。要件が「バックエンド不要・
  クライアント内永続化」と明記しているため、標準APIで十分と判断した。方針の詳細は
  `01-foundation/shared-kernel.yaml` の `data_store.policy` を参照。
- **通知音: `<audio>` 要素またはWeb Audio API（ブラウザ標準）。** 追加ライブラリ無し。
- **required_skills（プラグインSkill）: 採用しない。** UIは最低限の3画面に留まり、
  `harness/quality/design-baseline.md`（常時有効なLayer 1）で最低限の品質を担保できると
  判断した。実装中により高度なデザイン品質が必要だと判明した場合は `diff-design` で
  設計に立ち返って追加を検討する。

## 機能分割の根拠（なぜこの粒度・境界にしたか）

- 要件のFR-1/FR-2/FR-3が「入出力さえ合えば独立して作れる」ことを検証する目的で意図的に
  疎結合にまとめられていたため、それぞれを1機能に対応させた。これ以上細分化する
  （例: タイマー表示とタイマー操作を別機能にする）と、1秒ごとの状態更新という単一の
  関心事が2機能にまたがってしまい、`interfaces[]`経由の頻繁なイベント往復が必要になって
  かえって結合度が上がるため、現状の3分割が「小さすぎず、責務が単一」なバランス点と判断した。
- 依存の向きは要件の自然な発生順（設定→タイマー進行→記録）に沿った一方向のみとし、
  逆方向（session-logがtimer-coreに何かを返す、settingsがtimer-coreの状態を読む等）は
  発生しない設計にした。これにより3機能とも「自分の出力を待っている相手がいるかどうか」を
  意識するだけで実装でき、循環依存や双方向の同期処理を考える必要がない。
- `timer_settings` と `work_session_completed` は producer/consumer の2機能間だけで
  使われる値であり、`shared-kernel.yaml` の `common_types` には入れていない。共有カーネルに
  型を集約すると変更コストが上がり「本当に3機能共通のものだけに絞る」という原則に反するため、
  各 `contract.yaml` の `inputs`/`outputs` にそれぞれ明示的に定義する形にした。

## 進捗

進捗そのものはここに手書きしない。`apps/pomodoro-timer/PROGRESS.md`（自動生成）を参照。
