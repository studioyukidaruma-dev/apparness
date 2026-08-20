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

# schemas/status.schema.json の state enum と対応。CONVENTIONS.md 5節の状態機械の単一情報源はここではなく
# CONVENTIONS.md 側だが、値の並びはこの定数と一致させること。
STATUS_LINEAR_ORDER = [
    "NOT_STARTED",
    "CONTRACT_DRAFTED",
    "CONTRACT_APPROVED",
    "IN_PROGRESS",
    "IMPLEMENTED",
    "TESTED",
    "INTEGRATED",
]
STATUS_TERMINAL_STATES = {"INTEGRATED", "SUPERSEDED"}
STATUS_ALL_STATES = set(STATUS_LINEAR_ORDER) | {"BLOCKED", "SUPERSEDED"}

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


def get_status_porcelain(cwd: str) -> str | None:
    """`git status --porcelain` の生出力を返す。各行先頭の状態コード（例: ` M`）は
    先頭空白に意味があるため、`_run_git` の `strip()` は使わず改行のみを除去する。
    """
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain", "--untracked-files=all"],
            capture_output=True, text=True, cwd=cwd, timeout=3,
        )
        if out.returncode != 0:
            return None
        return out.stdout.rstrip("\n")
    except Exception:  # noqa: BLE001
        return None


def find_main_repo_root(worktree_toplevel: str) -> str:
    """git worktree のメインリポジトリのルートを返す（.git ファイルの gitdir 記載から辿る）。
    通常の（worktree でない）チェックアウトなら worktree_toplevel をそのまま返す。
    """
    import os

    git_path = os.path.join(worktree_toplevel, ".git")
    if os.path.isdir(git_path):
        return worktree_toplevel
    try:
        with open(git_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
    except OSError:
        return worktree_toplevel
    m = re.match(r"gitdir:\s*(.+)", content)
    if not m:
        return worktree_toplevel
    gitdir = m.group(1)
    # 例: <root>/.git/worktrees/<name> -> <root>
    marker = os.sep + ".git" + os.sep + "worktrees" + os.sep
    idx = gitdir.find(marker)
    if idx == -1:
        return worktree_toplevel
    return gitdir[:idx]


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


def simulate_write_result(tool_name: str, tool_input: dict, current_content: str) -> str:
    """PreToolUse 時点でまだ書き込まれていない、書き込み後のファイル内容をシミュレートする。
    Edit/MultiEdit はファイル全体を渡してこないため、Rule7 のような「書き込み後の内容」を
    見て判定するルールはこれで再現してから検査する。
    """
    if tool_name == "Write":
        return tool_input.get("content", "")
    if tool_name == "Edit":
        old = tool_input.get("old_string", "")
        new = tool_input.get("new_string", "")
        count = -1 if tool_input.get("replace_all") else 1
        return current_content.replace(old, new, count)
    if tool_name == "MultiEdit":
        content = current_content
        for edit in tool_input.get("edits", []) or []:
            old = edit.get("old_string", "")
            new = edit.get("new_string", "")
            if edit.get("replace_all"):
                content = content.replace(old, new)
            else:
                content = content.replace(old, new, 1)
        return content
    return current_content


def extract_scalar_field(content: str, key: str) -> str | None:
    """文字列コンテンツ（ファイルではなく）から `key: value` 形式の行を正規表現で軽量抽出する。"""
    m = re.search(rf"^\s*{re.escape(key)}\s*:\s*(\S.*?)\s*$", content, re.MULTILINE)
    if not m:
        return None
    return m.group(1).strip().strip('"\'')


def validate_status_transition(old_state: str | None, new_state: str) -> str | None:
    """status.yaml の `state` 遷移が CONVENTIONS.md 5節の状態機械に沿っているか判定する。
    妥当（または判定不能）なら None、不正なら拒否理由の文字列を返す。

    - `BLOCKED` はどの非終端状態からでも／どの状態へでも自由に出入りできる「一時停止」として扱う
      （どのレベルで止まっていたかは `state_history` を遡れば分かるが、v1 ではそこまで検証しない。
      既知の簡略化として、`BLOCKED` を経由した skip はすり抜けうる）。
    - `SUPERSEDED` はどの非終端状態からでも許可する（`diff-design` による置き換えはいつでも起こりうる）。
    - それ以外は `STATUS_LINEAR_ORDER` に沿った1段階前進のみ許可する。後退・複数段階の飛び越しは拒否する。
    """
    if not old_state or old_state == new_state:
        return None
    if new_state not in STATUS_ALL_STATES or old_state not in STATUS_ALL_STATES:
        return None  # 未知の値の妥当性は JSON Schema 側の責務。ここでは判定しない
    if old_state in STATUS_TERMINAL_STATES:
        return f"拒否: state は {old_state}（終端状態）から変更できません。"
    if new_state in ("SUPERSEDED", "BLOCKED") or old_state == "BLOCKED":
        return None

    old_idx = STATUS_LINEAR_ORDER.index(old_state)
    new_idx = STATUS_LINEAR_ORDER.index(new_state)
    if new_idx == old_idx + 1:
        return None
    if new_idx <= old_idx:
        return f"拒否: state を {old_state} から {new_state} に後退させることはできません。"
    skipped = ", ".join(STATUS_LINEAR_ORDER[old_idx + 1:new_idx])
    return (
        f"拒否: state を {old_state} から {new_state} へ直接進めることはできません"
        f"（{skipped} を飛ばしています）。1段階ずつ進めてください"
        f"（`CONTRACT_APPROVED` へ進めない場合は `BLOCKED` にして `blockers[]` に理由を記録してください）。"
    )


def extract_required_skills(content: str) -> list[dict]:
    """shared-kernel.yaml の `required_skills:` リストを軽量パースする。
    `- name: "..."` に続く `plugin_ref: "..."` / `purpose: "..."` を同一エントリとして拾う。
    フルな YAML パーサーではなく、テンプレートで規定した書式のみを前提にする。
    """
    m = re.search(r"^required_skills\s*:\s*(\[\s*\])?\s*$", content, re.MULTILINE)
    if not m or m.group(1) is not None:
        return []
    start = m.end()
    # 次のトップレベルキー（インデントなしの `key:` 行）までを required_skills のブロックとみなす。
    # PyYAML のデフォルト出力はリスト項目 `- name: ...` をインデントせず親キーと同じ列に置くため、
    # `^\S` のような単純な判定だとリスト項目自体を「次のキー」と誤検知する。`- ` で始まる行は除外する。
    block_match = re.search(r"^(?!-\s)[A-Za-z_]\S*\s*:", content[start:], re.MULTILINE)
    block = content[start:start + block_match.start()] if block_match else content[start:]

    skills: list[dict] = []
    current: dict | None = None
    for line in block.splitlines():
        name_m = re.match(r"^\s*-\s*name\s*:\s*(.+?)\s*$", line)
        if name_m:
            if current:
                skills.append(current)
            current = {"name": name_m.group(1).strip().strip('"\'')}
            continue
        if current is not None:
            for key in ("plugin_ref", "purpose"):
                field_m = re.match(rf"^\s*{key}\s*:\s*(.+?)\s*$", line)
                if field_m:
                    current[key] = field_m.group(1).strip().strip('"\'')
    if current:
        skills.append(current)
    return skills


def get_enabled_plugins(repo_root: str) -> set[str]:
    """.claude/settings.json と .claude/settings.local.json の enabledPlugins をマージして返す。
    キー形式は "<plugin-name>@<marketplace>"。JSON 標準ライブラリのみ使用。
    """
    import os

    enabled: set[str] = set()
    for name in ("settings.json", "settings.local.json"):
        path = os.path.join(repo_root, ".claude", name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        plugins = data.get("enabledPlugins")
        if isinstance(plugins, dict):
            enabled.update(k for k, v in plugins.items() if v)
        elif isinstance(plugins, list):
            enabled.update(plugins)
    return enabled


def deny(reason: str) -> None:
    print(reason, file=sys.stderr)
    sys.exit(2)


def allow() -> None:
    sys.exit(0)
