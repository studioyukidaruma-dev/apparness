# apparness 開発ロードマップ・引き継ぎメモ

このファイルは、`apparness` ハーネス**自体の開発**を中断・再開するための文書です。
（アプリ作成の進捗は `apps/<app-id>/PROGRESS.md`、ハーネスの使い方は `HARNESS_GUIDE.md` を見てください。
このファイルはその中間、「ハーネスというプロダクトを今どこまで作ったか」の記録です。）

## 次回セッションを始めるとき、最初にすること

1. `git status` と `git log --oneline -5`（`main` ブランチ）で現在の状態を確認する
2. `HARNESS_GUIDE.md` を読み、ハーネス全体の設計を思い出す
3. 本ファイルの「v1 で着手予定の項目」から何に取り組むか選ぶ

## リポジトリ構成

このプロジェクトは2つのGitHubリポジトリに分かれています。

| リポジトリ | 役割 | ブランチ運用 |
|---|---|---|
| `apparness`（このリポジトリ） | 開発用。ハーネス本体（`harness/`, `.claude/`）と、アプリ生成物（`apps/`）の両方を含む | 通常のGitHub運用（`main` + feature branch等）。ローカル/リモートの構造は一致 |
| [`apparness-harness`](https://github.com/studioyukidaruma-dev/apparness-harness) | 配布用テンプレート。`apps/` を含まない、ハーネス本体のみのスナップショット | `main` ブランチのみ。**このリポジトリを直接編集しない**（`apparness` 側で編集して同期する） |

**編集は必ず `apparness` の `main` で行う。** `apparness-harness` は `apparness` の `main` から `apps/` を除いた派生物であり、独立した開発対象ではありません。

## ハーネスを更新したら（`apparness-harness` への同期）

```
./scripts/sync-harness-template.sh
```

これで `main` の現在の内容（`apps/` を除く）が `apparness-harness` の `main` へ force push されます。
内部で `main` から孤立ブランチ `harness-template` を作り直し、push後に削除する、という手順を自動化しています
（詳しい経緯は git のコミット履歴、およびこのファイルの作成時のやり取りを参照）。

`git remote -v` で `harness-origin`（`apparness-harness` を指す）が設定されていることを前提とします。
無ければ:
```
git remote add harness-origin git@github.com:studioyukidaruma-dev/apparness-harness.git
```

## v0 で完了した内容（要約）

詳細は `HARNESS_GUIDE.md` を参照。

- 要件定義 → 設計 → 実装 → 組み上げ の4フェーズ構成（`requirements-analyst` / `solution-architect` / `feature-builder` / `integrator` の4 subagent）
- 機能ごとの独立性（`contract.yaml` による契約）と git worktree による並行実装
- `harness/hooks/pre_tool_use_guard.py` による7つの決定論的ルール（ハーネス非侵襲性、担当外ガード、契約凍結、進捗自動再生成、必須Skill充足ゲート、上位文書ガード、要件↔設計整合性ゲート）
- 自動化モード（`AUTONOMY.yaml`: MANUAL/SUPERVISED/AUTONOMOUS）。要件承認だけは常に人間必須
- 品質保証の二層構造（`harness/quality/*.md` の内蔵ベースライン + bundled skill + `required_skills[]`）
- 要件定義書の履歴管理（`00-requirements/history/`）と上位文書優先の原則
- 実地テスト: `apps/todo-app` で要件定義〜組み上げまでの一気通貫を確認済み

## v1 で完了した項目

- [x] **各フェーズでのコミット実行を Hook で強制する仕組み**。`harness/hooks/stop_commit_guard.py` を
  `Stop`/`SubagentStop` イベントに登録し、`status.yaml`/`requirements.machine.yaml`/
  `architecture.machine.yaml`（新規追加ファイルも含む）に未コミットの変更が残ったまま応答を
  終えようとした場合に停止をブロックするようにした（`CONVENTIONS.md` 7節 Rule 8、
  `HARNESS_GUIDE.md` 5節）。`Stop`/`SubagentStop` 用に `stop_hook_active` を見て無限ループを回避。
  ブランチ: `harness/stop-commit-guard`。
- [x] **`status.yaml` の状態遷移の妥当性チェック**。判定ロジックを
  `harness/hooks/lib/path_utils.py` の `validate_status_transition` に実装し、
  `pre_tool_use_guard.py`（Rule 9）が Edit/Write/MultiEdit のたびに自動で強制する。
  直線状態（`NOT_STARTED → ... → INTEGRATED`）の後退・複数段階の飛び越しと、終端状態
  （`INTEGRATED`/`SUPERSEDED`）からの変更を拒否する。人間/CI向けの手動確認 CLI として
  `harness/scripts/validate_status_transition.py` も追加した（`CONVENTIONS.md` 5節・7節 Rule 9）。
  **既知の簡略化**: `BLOCKED` を経由した遷移は検証しない（`BLOCKED` からはどの状態へも自由に
  遷移できるため、理論上は飛び越しチェックをすり抜けられる。`HARNESS_GUIDE.md` 11節参照）。
  ブランチ: `harness/status-transition-guard`。
- [x] **Bash 経由の間接的な書き込みを実際にブロックする**。`sed -i`/`cp`/`mv`/`tee`/リダイレクト等が
  Rule 1・2・3・5・6（`tool_input` を要求しない Rule）のいずれかに違反する場合、警告のみだったのを
  `exit 2` で Bash コマンドの実行自体を拒否するようにした（`CONVENTIONS.md` 7節末尾）。
  実装中、自分自身のセッションで実際にこの新しい挙動が発火し、**テストスクリプトの中でクォートに
  囲われた文字列（`payload "echo hi >> ..."` のような、実際には書き込みではない`>>`を含む文字列
  引数）まで誤検知することを実地で確認**した。
  ブランチ: `harness/block-bash-indirect-writes`。
  - **同一セッション内で撤回・修正**: 上記の誤検知への当初の対処（Bash検知全体を1回だけスキップする
    環境変数 `HARNESS_BASH_GUARD_UNLOCK=1` の新設）は、ユーザーから「AIがブロックされた際に自ら
    ロックを解除して実行できてしまい、決定論的強制の意味を失う。逃げ道ではなく根本的な解決を」
    という明確な指摘を受けて撤回した。代わりに検知ロジック自体を見直し、正規表現の直接マッチから
    `shlex`（標準ライブラリ、依存ゼロ）によるクォート考慮トークン化に置き換えることで、誤検知の
    原因（クォート内の `>` を演算子と誤認識すること）を根本的に解消した。バイパス用の環境変数は
    削除し、存在しない（`HARNESS_UNLOCK=1` は Rule 1 専用のまま維持）。18パターン
    （真陽性10・真陰性8）のテストで検証済み。ブランチ: `harness/fix-bash-guard-tokenizer`。
- [x] **CI連携（GitHub Actions）**。着手前に「配布ハーネスとしてアプリの素性がわからない状態でも
  意味があるCIか」を検討し、feature-builder/integrator が書くアプリ固有のテスト実行（技術スタック
  依存のため汎用化できない）は対象外とし、代わりに **Hookが課しているルールのうちアプリの技術
  スタックに依存しない範囲をgitの最終状態に対してサーバーサイドで再検証する**という方向にスコープを
  絞った。`harness/scripts/ci_check.py`（YAML Schema検証 + Rule 1/2/3/6/7/9相当の再検証 +
  PROGRESS.md鮮度チェック）と `.github/workflows/harness-checks.yml`（push全ブランチ + PR で起動、
  ブランチ保護は未設定で可視化のみ）を追加した（`HARNESS_GUIDE.md` 12節）。判定ロジックは
  `harness/hooks/lib/path_utils.py` をHookと共有し、基準のズレを防いでいる。ついでに `.github/**`
  もRule 1（ハーネス非侵襲性）のガード対象に追加した。10シナリオのテストで検証済み。
  ブランチ: `harness/ci-deterministic-checks`。
  **今後の課題**: Rule 5（必須Skill充足）とRule 8（コミット強制）はCIでは再検証できない
  （前者はCI実行環境にSkill有効化状態が存在せず、後者はpush時点で既にコミット済みのため）。
  アプリ固有のテスト実行をCIに載せたくなったら、「各機能に統一エントリポイント
  （例: `run_tests.sh`）を置く」という新しい規約をCONVENTIONS.mdに追加すれば、CI側は
  スタック非依存のまま対応できる（未着手）。

## v1 で着手予定の項目

`HARNESS_GUIDE.md` 11節「既知の制約」に対応する拡張候補。優先度は未定、着手時に相談して決める。

- [ ] ライブラリの脆弱性スキャンの自動化（`npm audit`/`pip-audit`/OSV等をHookやCIに統合）
- [ ] `find-skills` を用いた専門Skillの自動発見・`required_skills[]` への提案（現状は手動でSkill名を把握してからでないと使えない）

## 決めていないこと・要相談

- v1着手の優先順位
- `apparness-harness` 側にREADMEとして何を追加すべきか（現状は `apparness` と同じREADME.mdをそのまま使っている）
- CIにブランチ保護ルール（成功必須化）を設定するかどうか（現状は可視化のみ）
- アプリ固有のテスト実行をCIに載せる場合の統一エントリポイント規約（`run_tests.sh`等）をどう設計するか
