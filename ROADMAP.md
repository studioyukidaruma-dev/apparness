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

## v1 で着手予定の項目

`HARNESS_GUIDE.md` 11節「既知の制約」に対応する拡張候補。優先度は未定、着手時に相談して決める。

- [ ] **CI連携**（今回の会話で最初に挙がった項目）。GitHub Actions等で、`feature-builder`/`integrator` が書く結合テスト・単体テストを push/PR のたびに自動実行する仕組み。現状は Claude Code Hooks のみで完結させている
- [ ] Bash 経由の間接的な書き込み（`sed -i` 等）を警告だけでなく実際にブロックする（誤検知リスクとのトレードオフを検討）
- [ ] `status.yaml` の状態遷移の妥当性チェック（`NOT_STARTED` からいきなり `INTEGRATED` にする、等を防ぐ）
- [ ] ライブラリの脆弱性スキャンの自動化（`npm audit`/`pip-audit`/OSV等をHookやCIに統合）
- [ ] `find-skills` を用いた専門Skillの自動発見・`required_skills[]` への提案（現状は手動でSkill名を把握してからでないと使えない）

## 決めていないこと・要相談

- v1着手の優先順位
- CIをどのCIサービスにするか（GitHub Actions前提で書いたが未確定）
- `apparness-harness` 側にREADMEとして何を追加すべきか（現状は `apparness` と同じREADME.mdをそのまま使っている）
