#!/usr/bin/env bash
# The step of action.yml: write the report with the job summary, name it in the output "report", then check the
# rules. Exits 1 when a rule has a finding.
set -uo pipefail

if [ -n "$SPEC_TRACE_INPUT_COMMAND" ]; then
  # Shell words, so a quoted path with spaces stays one word. The workflow's author writes the input.
  eval "spec_trace=($SPEC_TRACE_INPUT_COMMAND)"
else
  version=$(node -p 'require(process.argv[1]).version' "$GITHUB_ACTION_PATH/package.json")
  spec_trace=(npx --yes "@opensoftware/spec-trace@$version")
fi

config=()
[ -n "$SPEC_TRACE_INPUT_CONFIG" ] && config=(--config "$SPEC_TRACE_INPUT_CONFIG")

base=$SPEC_TRACE_INPUT_BASE
if [ -z "$base" ]; then
  base=$(node -e 'process.stdout.write(String(require(process.env.GITHUB_EVENT_PATH).pull_request?.base?.sha ?? ""))')
fi

out=${SPEC_TRACE_INPUT_OUT:-$RUNNER_TEMP/spec-trace/spec-trace.json}
args=(report --out "$out" "${config[@]}")
[ -n "$base" ] && args+=(--base "$base")
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && args+=(--summary "$GITHUB_STEP_SUMMARY")
while IFS= read -r folder; do
  [ -n "$folder" ] && args+=(--evidence "$folder")
done <<< "$SPEC_TRACE_INPUT_EVIDENCE"
"${spec_trace[@]}" "${args[@]}" || exit $?
echo "report=$out" >> "$GITHUB_OUTPUT"

[ -z "$SPEC_TRACE_INPUT_RULES" ] && exit 0
"${spec_trace[@]}" check --only "$SPEC_TRACE_INPUT_RULES" "${config[@]}"
