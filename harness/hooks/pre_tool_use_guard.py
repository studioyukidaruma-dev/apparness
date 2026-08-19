#!/usr/bin/env python3
"""PreToolUse hook: harness/CONVENTIONS.md 7節の Rule 1〜3 を強制する。
**依存ゼロ**（標準ライブラリのみ）。Edit/Write/MultiEdit/NotebookEdit は確実にブロックする。
Bash 経由の間接書き込みは v0 では警告のみで非ブロック（誤検知回避のため）。

exit 0 = 許可, exit 2 = 拒否（stderr に理由）。
"""
from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import path_utils  # noqa: E402

HARNESS_PATH_RE = re.compile(r"^(harness/|\.claude/)")
FEATURE_SCOPE_RE = re.compile(r"^apps/([^/]+)/03-features/([^/]+)/(.*)$")
FEATURE_CONTRACT_RE = re.compile(r"^apps/([^/]+)/03-features/([^/]+)/contract\.yaml$")
DESIGN_CONTRACT_RE = re.compile(r"^apps/([^/]+)/02-design/features/([^/]+)\.contract\.yaml$")


def check_rule1_harness_immutability(rel_path: str, cwd: str) -> str | None:
    if not HARNESS_PATH_RE.match(rel_path):
        return None
    if os.environ.get("HARNESS_UNLOCK") == "1":
        print(f"警告: HARNESS_UNLOCK=1 により {rel_path} への書き込みガードを解除しています", file=sys.stderr)
        return None
    branch = path_utils.get_current_branch(cwd) or ""
    if branch.startswith("harness/"):
        return None
    return (
        f"拒否: {rel_path} はハーネス本体です。アプリ作成中は書き込みが保護されています。\n"
        f"意図的な変更なら `harness/<topic>` ブランチで作業するか、"
        f"一時的に環境変数 HARNESS_UNLOCK=1 を設定してください。"
    )


def check_rule2_feature_scope(rel_path: str, cwd: str) -> str | None:
    m = FEATURE_SCOPE_RE.match(rel_path)
    if not m:
        return None
    _app_id, feature_id, rest = m.groups()
    if rest == "status.yaml":
        return None  # 状態遷移は担当者・integrator 双方が正当に更新するため対象外
    toplevel = path_utils.get_worktree_toplevel(cwd)
    if not toplevel:
        return None  # git 情報が取れない場合は判定不能としてブロックしない
    current_scope = os.path.basename(toplevel)
    if current_scope == feature_id:
        return None
    return (
        f"拒否: {rel_path} はこのセッションの担当範囲外です（このセッションは {current_scope!r} 用）。\n"
        f"{feature_id!r} を編集するには、対応する worktree "
        f"(`apps/<app>/.worktrees/{feature_id}/...`) でセッションを開始してください。"
    )


def check_rule3_contract_freeze(rel_path: str, toplevel: str) -> str | None:
    m = FEATURE_CONTRACT_RE.match(rel_path)
    if m:
        status_path = os.path.join(toplevel, os.path.dirname(rel_path), "status.yaml")
        state = path_utils.read_state_field(status_path)
        if state is None or state in ("NOT_STARTED", "CONTRACT_DRAFTED"):
            return None
        return (
            f"拒否: {rel_path} は state={state} のため凍結されています（CONTRACT_DRAFTED までのみ変更可）。\n"
            f"仕様変更が必要な場合は `diff-design` skill で新しい機能バージョンとして起票してください。"
        )

    m = DESIGN_CONTRACT_RE.match(rel_path)
    if m:
        app_id, _feature_id = m.groups()
        architecture_path = os.path.join(toplevel, f"apps/{app_id}/02-design/architecture.machine.yaml")
        status = path_utils.read_state_field(architecture_path)
        if status is None or status == "DRAFT":
            return None
        return (
            f"拒否: {rel_path} は architecture.machine.yaml が status={status} のため凍結されています"
            f"（DRAFT の間のみ変更可）。"
        )
    return None


def run_checks(rel_path: str, cwd: str, toplevel: str) -> str | None:
    for check in (check_rule1_harness_immutability, check_rule2_feature_scope):
        reason = check(rel_path, cwd)
        if reason:
            return reason
    return check_rule3_contract_freeze(rel_path, toplevel)


def main() -> int:
    payload = path_utils.read_hook_input()
    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {}) or {}
    cwd = payload.get("cwd") or os.getcwd()

    toplevel = path_utils.get_worktree_toplevel(cwd) or cwd

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        candidates = path_utils.extract_bash_candidate_paths(command)
        warnings = []
        for candidate in candidates:
            rel_path = path_utils.to_worktree_relative(candidate, toplevel)
            reason = run_checks(rel_path, cwd, toplevel)
            if reason:
                warnings.append(reason)
        if warnings:
            print(
                "警告: Bash コマンドがガード対象パスへの書き込みを含む可能性があります"
                "（v0 では Bash はブロックしません。構造化ツールでの編集を推奨します）:",
                file=sys.stderr,
            )
            for w in warnings:
                print(f"  - {w}", file=sys.stderr)
        return 0

    for abs_path in path_utils.extract_structured_edit_paths(tool_name, tool_input):
        rel_path = path_utils.to_worktree_relative(abs_path, toplevel)
        reason = run_checks(rel_path, cwd, toplevel)
        if reason:
            print(reason, file=sys.stderr)
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
