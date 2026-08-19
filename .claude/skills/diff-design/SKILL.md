---
name: diff-design
description: 仕様変更・要件追加が生じた際に、旧設計との差分を機械的に明らかにし、新しい設計書を起こす。変更が必要な機能だけを新規に作り直し、変更のない機能は既存の実装を再利用する。「仕様を変えたい」「機能を追加したい」と言われたら使う。
---

# diff-design

既存アプリ（`apps/<app_id>/` が既に存在する）に対する仕様変更・要件追加のための手順です。

1. `requirements-analyst` subagent で変更点をヒアリングし、
   `requirements.machine.yaml` の `version` をインクリメントして更新する
   （`requirements.md` も同期させる）。
2. 現在の `apps/<app_id>/02-design/architecture.machine.yaml` を
   `02-design/history/architecture.v<旧バージョン>.yaml` としてコピー保存する。
3. `solution-architect` subagent で新しい `architecture.machine.yaml`
   （`design_version` をインクリメント、`based_on_requirements_version` を更新）を作成する。
   独立機能の原則（`harness/CONVENTIONS.md` 6 節）は変更時も維持する。
4. 新旧を比較して差分レポートを出す:
   ```
   python3 harness/scripts/diff_architecture.py apps/<app_id>/02-design/history/architecture.v<旧>.yaml apps/<app_id>/02-design/architecture.machine.yaml
   ```
5. レポートに従って:
   - **追加・変更された機能**: 新しい `feature_id`（例: `<old-id>-v2`）を採番し、
     `new-feature-worktree` skill で新規 worktree を作成する。旧 feature の `status.yaml` は
     `state: SUPERSEDED`、`superseded_by: <new-id>` に更新する。
   - **削除された機能**: 対応する `status.yaml` を `state: SUPERSEDED`（後継なし）にする。
   - **変更なしの機能**: 何もしない。既存の実装・worktree・status.yaml をそのまま再利用する。
6. ユーザーに差分レポートと対応方針を提示し、承認を得てから `architecture.machine.yaml` を
   `status: APPROVED` にする。

この手順により、変更が必要な機能だけが新規プロジェクト化され、無関係な機能は無駄な作り直しをしません。
