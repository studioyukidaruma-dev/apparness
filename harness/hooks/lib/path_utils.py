"""hooks/*.py が共有するヘルパー。**依存ゼロ**（標準ライブラリのみ）を厳守すること。
Hook はツール呼び出しのたびに毎回起動されるため、起動コストと信頼性を最優先する。
"""
from __future__ import annotations

import json
import re
import subprocess
import sys

MULTI_EDIT_FILE_FIELD = "file_path"
NOTEBOOK_EDIT_FIELD = "notebook_path"

# Bash からの間接書き込みをヒューリスティックに検知するための簡易パターン（v0: 警告のみ、非ブロック）
_BASH_WRITE_PATTERNS = [
    re.compile(r">>?\s*([^\s|;&]+)"),
    re.compile(r"\bcp\s+\S+\s+([^\s|;&]+)"),
    re.compile(r"\bmv\s+\S+\s+([^\s|;&]+)"),
    re.compile(r"\btee\s+([^\s|;&]+)"),
    re.compile(r"\bsed\s+-i\S*\s+\S+\s+([^\s|;&]+)"),
]


def read_hook_input() -> dict:
    raw = sys.stdin.read()
    try:
        return json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        return {}


def _run_git(args: list[str], cwd: str | None = None) -> str | None:
    try:
        out = subprocess.run(
            ["git", *args], capture_output=True, text=True, cwd=cwd, timeout=3
        )
        if out.returncode != 0:
            return None
        return out.stdout.strip()
    except Exception:  # noqa: BLE001
        return None


def get_worktree_toplevel(cwd: str) -> str | None:
    return _run_git(["rev-parse", "--show-toplevel"], cwd=cwd)


def get_current_branch(cwd: str) -> str | None:
    return _run_git(["branch", "--show-current"], cwd=cwd)


def extract_structured_edit_paths(tool_name: str, tool_input: dict) -> list[str]:
    """Edit/Write/MultiEdit/NotebookEdit の対象絶対パスを返す。"""
    if tool_name == "NotebookEdit":
        path = tool_input.get(NOTEBOOK_EDIT_FIELD)
        return [path] if path else []
    if tool_name in ("Edit", "Write", "MultiEdit"):
        path = tool_input.get(MULTI_EDIT_FILE_FIELD)
        return [path] if path else []
    return []


def extract_bash_candidate_paths(command: str) -> list[str]:
    """Bash コマンド文字列からヒューリスティックにパス候補を抽出する（警告用途、非ブロック）。"""
    candidates: list[str] = []
    for pattern in _BASH_WRITE_PATTERNS:
        candidates.extend(pattern.findall(command))
    return [c.strip("'\"") for c in candidates if c and not c.startswith("-")]


def to_worktree_relative(abs_or_rel_path: str, toplevel: str) -> str:
    """worktree のルートからの相対パス（POSIX区切り）を返す。既に相対ならそのまま正規化する。"""
    import os

    if not os.path.isabs(abs_or_rel_path):
        return abs_or_rel_path.replace("\\", "/")
    try:
        rel = os.path.relpath(abs_or_rel_path, toplevel)
    except ValueError:
        return abs_or_rel_path.replace("\\", "/")
    return rel.replace("\\", "/")


def read_state_field(status_yaml_path) -> str | None:
    """status.yaml / architecture.machine.yaml から `state:`/`status:` 行だけを正規表現で軽量抽出する。
    hooks は PyYAML に依存しないため、フルパースはしない。
    """
    try:
        with open(status_yaml_path, "r", encoding="utf-8") as f:
            for line in f:
                m = re.match(r"^\s*(state|status)\s*:\s*(\S+)", line)
                if m:
                    return m.group(2).strip('"\'')
    except OSError:
        return None
    return None


def deny(reason: str) -> None:
    print(reason, file=sys.stderr)
    sys.exit(2)


def allow() -> None:
    sys.exit(0)
