#!/usr/bin/env bash
# The step of action.yml: request and status for the pull request of the event, then the outputs "decision" and
# "record". Exits 0 while the gate waits; the commit status "gatekeeper" stays pending until a person decides.
set -uo pipefail

if [ -n "$GATEKEEPER_INPUT_COMMAND" ]; then
  # Shell words, so a quoted path with spaces stays one word. The workflow's author writes the input.
  eval "gatekeeper=($GATEKEEPER_INPUT_COMMAND)"
else
  version=$(node -p 'require(process.argv[1]).version' "$GITHUB_ACTION_PATH/package.json")
  gatekeeper=(npx --yes "@opensoftware/gatekeeper@$version")
fi

# A pull_request event names the pull request; a comment on a pull request names it as its issue.
pr=$(node -e 'const e = require(process.env.GITHUB_EVENT_PATH);
  process.stdout.write(String(e.pull_request?.html_url ?? e.issue?.pull_request?.html_url ?? ""))')
if [ -z "$pr" ]; then
  echo "gatekeeper: the event has no pull request" >&2
  exit 2
fi

export GATEKEEPER_FORGE_TOKEN=$GATEKEEPER_INPUT_TOKEN
[ -z "${GATEKEEPER_FORGE_URL:-}" ] && [ -n "${GITHUB_API_URL:-}" ] && export GATEKEEPER_FORGE_URL=$GITHUB_API_URL
record=${GATEKEEPER_INPUT_RECORD:-$RUNNER_TEMP/gatekeeper/record.json}
args=(--policy "$GATEKEEPER_INPUT_POLICY" --groups "$GATEKEEPER_INPUT_GROUPS" --pull-request "$pr" --record "$record")

"${gatekeeper[@]}" request "${args[@]}" --out "$RUNNER_TEMP/gatekeeper/gate.json" || exit $?
"${gatekeeper[@]}" status "${args[@]}"
code=$?

if [ -f "$record" ]; then
  echo "decision=$(node -p 'require(process.argv[1]).decision' "$(realpath "$record")")" >> "$GITHUB_OUTPUT"
  echo "record=$record" >> "$GITHUB_OUTPUT"
elif [ "$code" -eq 3 ]; then
  echo "decision=pending" >> "$GITHUB_OUTPUT"
  exit 0
fi
exit "$code"
