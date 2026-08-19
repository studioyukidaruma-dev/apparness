# harness/ — apparness ハーネス本体

このディレクトリと、リポジトリルート直下の `.claude/`（agents/skills/hooks 設定）が
「apparness ハーネス」の本体です。**アプリ作成作業中はこれらへの書き込みが Hooks で保護されます**
（`harness/<topic>` ブランチでの意図的な変更か、`HARNESS_UNLOCK=1` を設定した場合のみ可能）。

個々のアプリの成果物は `apps/<app-id>/` に生成されます。ハーネス自体はテンプレートとして、
どのアプリ作成でも繰り返し使われることを想定しています。詳しい規約は `CONVENTIONS.md` を参照してください。

## セットアップ

```
pip install -r harness/requirements.txt
```

（`harness/hooks/` 配下は依存ゼロで動くよう作られていますが、`harness/scripts/` 配下は
PyYAML / jsonschema を使います。）

## 全体フロー

```
1. init-app skill        → 00-requirements/ の雛形生成 + requirements-analyst へ引き継ぎ
2. requirements-analyst   → requirements.md / requirements.machine.yaml を作成・承認
3. solution-architect      → shared-kernel.yaml / architecture.machine.yaml / 各 feature の
                              contract ドラフトを作成・承認（独立機能への分割はここで行う）
4. new-feature-worktree skill（機能ごとに繰り返す）
                            → git worktree 作成 + SPEC.md/contract.yaml/status.yaml 雛形生成
5. feature-builder          → 各 worktree 内で機能を実装（担当者ごと・並行可能）
6. integrator                → 全機能 TESTED 後、merge して結線し 04-integration/ を作成
```

いつ中断しても、`apps/<app-id>/STATE.machine.yaml`（機械向け）と `PROGRESS.md`（人間向け）を見れば
どこまで終わっているか・次に何をすべきかが分かります。この 2 ファイルは自動生成なので手書きしないでください。

## 仕様変更・要件追加が生じたら

`diff-design` skill を使ってください。旧設計との差分を機械的に算出し、変更が必要な機能だけを
新規に作り直し、変更のない機能はそのまま再利用します。

## ディレクトリの見取り図

詳細は `CONVENTIONS.md` 1 節を参照。要点だけ書くと:

- `.claude/` — hooks/agents/skills の実効設定（リポジトリルート直下。worktree にも自動複製される）
- `harness/hooks/` — 決定論的ガード（依存ゼロの Python）
- `harness/templates/` — 各種ドキュメントのひな形
- `harness/schemas/` — machine-readable ファイルの JSON Schema
- `harness/scripts/` — scaffold 生成・進捗再生成・設計差分計算などの決定論ロジック

## Hooks が強制する約束事項

`CONVENTIONS.md` 7 節を参照。ハーネス非侵襲性・担当外ガード・契約凍結・進捗自動再生成の 4 つを
Claude Code の PreToolUse / PostToolUse hooks で強制しています。AI の自己申告には頼っていません。

## 既知の制約（v0 スコープ）

- Bash 経由の間接的な書き込み（`sed -i` 等）は検知しても警告のみで、ブロックしません。
- 状態遷移（`status.yaml` の `state`）の妥当性チェックはまだありません。
- CI との連携はまだありません（Claude Code Hooks のみで完結させています）。
- ライブラリの脆弱性スキャンは自動化されておらず、`solution-architect` の調査に依存しています。

これらは実際にアプリを 1 本作ってみてから、必要に応じて拡張してください。
