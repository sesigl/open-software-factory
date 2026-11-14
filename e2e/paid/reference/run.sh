#!/usr/bin/env bash
# The paid reference run (ADR 0128): the factory of this checkout implements one issue of a sample repository with a
# paid model. A Forgejo of this machine holds the sample repository and its issue, so the run needs no token of
# another forge and pushes nowhere else. The modules run from the e2e image of this workspace (ADR 0076); LiteLLM
# sends the model calls to OpenRouter with a budget of 0.50 USD for the run.
#
# Needs: Docker with Compose, the image osf-e2e:workspace (node e2e/scripts/images.ts), OPENROUTER_API_KEY.
# Optional: MODEL (default the model of weekly-paid.yml), OUT (default ./reference-run), WAIT_SECONDS (default 1200).
# It succeeds when the run completed and the sample repository has an open pull request; it writes the summary to
# $OUT/summary.md and the run's files to $OUT.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../lib.sh
. "$here/../lib.sh"
paid_out reference-run
forge_port=3300
forge="http://127.0.0.1:$forge_port"
inner="http://host.docker.internal:$forge_port"
owner=osf
password="$(secret)"
paid_cleanup() { docker rm -f osf-reference-forgejo >/dev/null 2>&1 || true; }

echo "Starting Forgejo with the sample repository"
docker run -d --name osf-reference-forgejo -p "127.0.0.1:$forge_port:3000" \
  --add-host host.docker.internal:host-gateway \
  -e FORGEJO__security__INSTALL_LOCK=true -e FORGEJO__database__DB_TYPE=sqlite3 \
  -e FORGEJO__repository__DEFAULT_BRANCH=main -e FORGEJO__service__DISABLE_REGISTRATION=true \
  -e "FORGEJO__server__ROOT_URL=$inner/" code.forgejo.org/forgejo/forgejo:11 >/dev/null
for _ in $(seq 60); do curl -fsS "$forge/api/healthz" >/dev/null 2>&1 && break || sleep 2; done
docker exec -u git osf-reference-forgejo forgejo admin user create --admin --username "$owner" \
  --password "$password" --email "$owner@example.invalid" --must-change-password=false >/dev/null
token="$(curl -fsS -u "$owner:$password" -H 'content-type: application/json' \
  --data '{"name":"reference-run","scopes":["write:repository","write:issue","write:user"]}' \
  "$forge/api/v1/users/$owner/tokens" | jq -r .sha1)"
mask "$token" "$password"
api() { curl -fsS -H "authorization: token $token" -H 'content-type: application/json' "$@"; }

# The sample: a tiny Node library with one test, and an issue that asks for one function and its test.
api --data '{"name":"sample","default_branch":"main"}' "$forge/api/v1/user/repos" >/dev/null
sample="$work/sample"
mkdir -p "$sample"
cat >"$sample/README.md" <<'EOF'
# sample

A tiny math library. Run the tests with `node --test`; they need no install.
EOF
cat >"$sample/math.js" <<'EOF'
export function subtract(a, b) {
  return a - b;
}
EOF
cat >"$sample/math.test.js" <<'EOF'
import assert from "node:assert/strict";
import { test } from "node:test";
import { subtract } from "./math.js";

test("subtract", () => assert.equal(subtract(3, 2), 1));
EOF
echo '{ "name": "sample", "type": "module", "private": true }' >"$sample/package.json"
git -C "$sample" init -q -b main
git -C "$sample" -c user.name=osf -c user.email=osf@example.invalid add .
git -C "$sample" -c user.name=osf -c user.email=osf@example.invalid commit -qm "A tiny math library"
git -C "$sample" push -q "http://$owner:$token@127.0.0.1:$forge_port/$owner/sample.git" main
issue="$(api --data '{"title":"Add a function add(a, b)","body":"Add `add(a, b)` to math.js, which returns the sum of a and b, and a test of it in math.test.js."}' \
  "$forge/api/v1/repos/$owner/sample/issues" | jq -r .html_url)"
echo "Issue: $issue" | tee -a "$summary"

echo "Starting the factory"
paid_start osf-reference
paid_netrc host.docker.internal "$owner" "$token"

echo "Submitting the issue as a work item"
paid_submit "Add a function add(a, b)" forgejo "$issue"

pull="$(api "$forge/api/v1/repos/$owner/sample/pulls?state=open" | jq -r '.[0].number // empty')"
[ -n "$pull" ] || fail "the run completed, but the sample repository has no open pull request"
api "$forge/api/v1/repos/$owner/sample/pulls/$pull" | jq -r '"Pull request: \(.html_url) (\(.title))"' | tee -a "$summary"
{
  echo
  echo '```diff'
  curl -fsS -H "authorization: token $token" "$forge/api/v1/repos/$owner/sample/pulls/$pull.diff"
  echo '```'
} | tee -a "$summary"
