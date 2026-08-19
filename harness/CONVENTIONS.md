# CONVENTIONS.md — ハーネス規約の単一情報源

このファイルは `harness/` 配下の hooks / scripts / templates / schemas と、
`.claude/agents` / `.claude/skills` のすべてが前提とする命名規則・パス規則・状態機械の定義です。
これらを変更する場合は、必ずこのファイルを先に更新してから、参照している他のファイルを揃えてください。

対象読者は「機械（hooks/scripts/agents/skills）」と「ハーネスを保守する人間」です。
個々のアプリの進捗を見るための文書ではありません（それは `apps/<app-name>/PROGRESS.md` です）。

## 1. ディレクトリ構造

```
/.claude/                     ← 実効設定。git worktree で全 worktree に自動複製される
  settings.json               ← hooks 登録
  agents/*.md                 ← ハーネス共通 subagent
  skills/*/SKILL.md           ← ハーネス共通 skill
/harness/                     ← ハーネス本体。アプリ作成中は書き込みガード対象（Rule 1）
  README.md / CONVENTIONS.md
  hooks/                      ← .claude/settings.json から呼ばれる実行スクリプト
  templates/                  ← 各種ドキュメントのひな形
  schemas/                    ← JSON Schema（machine-readable ファイルの検証用）
  scripts/                    ← hooks/skills から呼ばれる決定論ロジック
/apps/<app-id>/                ← 生成物。init-app skill が都度生成する
  00-requirements/
    requirements.md            ← 人間向け要件定義書
    requirements.machine.yaml  ← 機械向け構造化要件（schemas/requirements.schema.json）
  01-foundation/
    shared-kernel.yaml         ← 全機能が依存する共有契約（型・認証方式・DB方針など）
  02-design/
    design.md                  ← 人間向け設計書
    architecture.machine.yaml  ← 機械向け設計（schemas/architecture.schema.json）
    features/<feature-id>.contract.yaml  ← 各機能の I/O 契約ドラフト（設計時点）
    history/                   ← 旧バージョンの architecture.machine.yaml を退避
  03-features/<feature-id>/    ← 1 機能 = 1 プロジェクト = 1 git worktree
    SPEC.md                    ← 人間向け機能仕様（このディレクトリ内で完結）
    contract.yaml              ← 機械向け I/O 契約（schemas/feature-contract.schema.json）
    status.yaml                ← 機械向け進捗状態（schemas/status.schema.json）
    src/ tests/
    .claude/                   ← この機能限定の追加 skill/agent（任意、harness 本体を汚さない）
  04-integration/
    integration.md             ← 組み上げ記録
    assembly/                  ← 組み上げコード
  PROGRESS.md                  ← 人間向け進捗ダッシュボード。**自動生成・手書き禁止**
  STATE.machine.yaml           ← 機械向け全体状態。**自動生成・手書き禁止**
  .worktrees/<feature-id>/     ← git worktree の実体（.gitignore 対象）
```

## 2. ID・命名規則

- `app-id`: kebab-case。例 `hello-world-todo`
- `feature-id`: kebab-case。同一 app 内で一意。例 `user-signup`, `todo-list-api`
- 仕様変更で機能を置き換える場合、新 ID は `<old-id>-v2`, `<old-id>-v3`... とする

## 3. ブランチ命名規則

| 用途 | 形式 | 例 |
|---|---|---|
| アプリ雛形作成 | `app/<app-id>/bootstrap` | `app/hello-world-todo/bootstrap` |
| 機能実装 | `feature/<app-id>/<feature-id>` | `feature/hello-world-todo/todo-list-api` |
| ハーネス保守 | `harness/<topic>` | `harness/fix-progress-renderer` |
| 統合作業（任意） | `integration/<app-id>` | `integration/hello-world-todo` |

## 4. worktree パス規則

```
apps/<app-id>/.worktrees/<feature-id>/
```
git worktree の実体は同一リポジトリの追跡ファイルをそのままチェックアウトするため、
このパスの中にも `apps/<app-id>/03-features/<feature-id>/` という同一の相対パスが現れます。
担当者はこのさらに深い階層（`apps/<app-id>/.worktrees/<feature-id>/apps/<app-id>/03-features/<feature-id>/`）を
cwd としてセッションを開始してください（`new-feature-worktree` skill が起動コマンドを案内します）。

## 5. 状態機械（`status.yaml` の `state` フィールド）

```
NOT_STARTED → CONTRACT_DRAFTED → CONTRACT_APPROVED → IN_PROGRESS → IMPLEMENTED → TESTED → INTEGRATED
```

追加で許容する状態:
- `BLOCKED`: 何らかの理由で作業が止まっている（`blockers[]` に理由を記録）
- `SUPERSEDED`: 仕様変更により後継の feature-id に置き換えられた（`superseded_by` に後継 ID を記録）

状態遷移は基本的に前進のみを想定します（v0 では遷移の妥当性チェックは行いません。v1 で
`scripts/validate_status_transition.py` を追加予定）。

## 6. 「独立機能」の設計原則

`architecture.machine.yaml` の `features[]` は互いへの `depends_on` を持ちません。
機能間のつながりは `interfaces[]`（`producer_feature` の `producer_output` を
`consumer_feature` の `consumer_input` として渡す、という宣言）でのみ表現します。
これにより「入出力さえわかれば内部を知らなくてよい」という独立性を構造的に強制します。

全機能が共通で依存してよいものは `01-foundation/shared-kernel.yaml`
（DDD でいう Shared Kernel）に限定し、機能ごとの `contract.yaml` から参照します。

## 7. Hooks が強制する 4 ルール（詳細は `harness/hooks/pre_tool_use_guard.py` 参照）

1. **ハーネス非侵襲性**: `harness/**` と `.claude/**`（リポジトリルート直下）への書き込みは、
   現在のブランチが `harness/` プレフィックスでない限り拒否する。
2. **担当外ガード**: `apps/<app-id>/03-features/<feature-id>/**`（`status.yaml` を除く）への書き込みは、
   現在の worktree ルートの basename が `<feature-id>` と一致しない限り拒否する。
3. **契約凍結**: `contract.yaml` への書き込みは、対応する `status.yaml` の `state` が
   `NOT_STARTED` または `CONTRACT_DRAFTED` でない限り拒否する。
4. **進捗自動再生成**: `status.yaml` が更新されたら `harness/scripts/render_progress.py` を実行し、
   `PROGRESS.md` / `STATE.machine.yaml` を再生成する（非ブロッキング）。

v0 では Edit/Write/MultiEdit/NotebookEdit という構造化ツール呼び出しのみを確実にブロックします。
Bash 経由の間接的な書き込み（`sed -i` 等）は検知しても警告のみで、ブロックはしません
（誤検知で Bash 全体を止める開発体験の悪化を避けるため。v1 で強化予定）。

## 8. 緊急避難

Rule 1（ハーネス非侵襲性）を意図的に解除したい場合は環境変数 `HARNESS_UNLOCK=1` を設定してください。
解除時は stderr に警告が出ます。恒常的な運用には使わないでください。
