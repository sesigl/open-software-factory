#!/usr/bin/env bash
# PreToolUse hook for Claude Code: refuse edits to protected paths. The rules live in `osf protect-paths`
# (tools/hooks/protect-paths.ts, scenarios in tools/features/protect-paths.feature); it reads the event on stdin.
# A person approves protected paths for one session with OSF_APPROVED_PATHS (tools/README.md#configuration).
set -euo pipefail
exec node "${CLAUDE_PROJECT_DIR:-$PWD}/tools/bin/osf.ts" protect-paths
