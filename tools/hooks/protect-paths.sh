#!/usr/bin/env bash
# PreToolUse hook for Claude Code: refuse edits to protected paths.
# This is a fast local guard. The real guard is CI (CODEOWNERS and the SPECGUARD check), which applies to
# every harness and every author.
set -euo pipefail

input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")
path=$(jq -r '.tool_input.file_path // empty' <<<"$input")
old=$(jq -r '.tool_input.old_string // empty' <<<"$input")
[ -z "$path" ] && exit 0
rel=${path#"${CLAUDE_PROJECT_DIR:-$PWD}"/}

refuse() { echo "Protected: $rel. $1 Ask a person (AGENTS.md, Hard rules)." >&2; exit 2; }

case "$rel" in
  contracts/*|docs/quality/*|tools/checks/*|.github/workflows/*|CODEOWNERS)
    refuse "This path changes the rules or the contracts." ;;
  */features/*.feature)
    # New files and new planned scenarios are allowed. Rewriting a file with implemented scenarios,
    # or an edit that touches an implemented scenario, is not.
    if [ -f "$path" ] && grep -q "@status=implemented" "$path"; then
      [ "$tool" = "Write" ] && refuse "The file contains implemented scenarios."
      grep -q "@status=implemented" <<<"$old" && refuse "The edit touches an implemented scenario."
    fi ;;
esac
exit 0
