#!/usr/bin/env bash
# The step of action.yml: bundle the reports, verify the bundle and, on a pull request, attach it with a link to the
# run. Exits 1 when the verification failed, after the attach.
set -uo pipefail
shopt -s globstar nullglob

if [ -n "$PROOF_INPUT_COMMAND" ]; then
  # Shell words, so a quoted path with spaces stays one word. The workflow's author writes the input.
  eval "proof=($PROOF_INPUT_COMMAND)"
else
  version=$(node -p 'require(process.argv[1]).version' "$GITHUB_ACTION_PATH/package.json")
  proof=(npx --yes "@opensoftware/proof@$version")
fi

# A field of the event payload, for example pull_request.html_url; empty when it is missing.
event() {
  node -e 'const value = process.argv[1].split(".").reduce((at, key) => at?.[key], require(process.env.GITHUB_EVENT_PATH));
process.stdout.write(value === undefined ? "" : String(value));' "$1"
}

pr=$(event pull_request.html_url)
commit=$(event pull_request.head.sha)
out="$RUNNER_TEMP/proof/evidence"

args=(bundle --out "$out" --commit "${commit:-$GITHUB_SHA}")
[ -n "$pr" ] && args+=(--pull-request "$pr")
while IFS= read -r pattern; do
  [ -n "$pattern" ] && for file in $pattern; do args+=(--playwright "$file"); done
done <<< "$PROOF_INPUT_PLAYWRIGHT"
while IFS= read -r pattern; do
  [ -n "$pattern" ] && for file in $pattern; do args+=(--junit "$file"); done
done <<< "$PROOF_INPUT_JUNIT"
"${proof[@]}" "${args[@]}" || exit 1
echo "bundle=$out" >> "$GITHUB_OUTPUT"

checks=(verify "$out")
for id in $PROOF_INPUT_SCENARIOS; do checks+=(--scenario "$id"); done
"${proof[@]}" "${checks[@]}"
verified=$?

if [ -n "$pr" ]; then
  [ -z "${PROOF_FORGE_URL:-}" ] && [ -n "${GITHUB_API_URL:-}" ] && export PROOF_FORGE_URL="$GITHUB_API_URL"
  "${proof[@]}" attach "$out" --bundle-url "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" || exit 1
fi
exit "$verified"
