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
e2e="$(cd "$here/../.." && pwd)"
: "${OPENROUTER_API_KEY:?set OPENROUTER_API_KEY}"
MODEL="${MODEL:-deepseek/deepseek-v4.1-flash-1017}"
OUT="$(mkdir -p "${OUT:-reference-run}" && cd "${OUT:-reference-run}" && pwd)"
WAIT_SECONDS="${WAIT_SECONDS:-1200}"
work="$(mktemp -d)"
forge_port=3300
forge="http://127.0.0.1:$forge_port"
inner="http://host.docker.internal:$forge_port"
owner=osf

# Random values of this run only; none of them outlives the job.
secret() { od -An -N16 -tx1 /dev/urandom | tr -d ' \n'; }
password="$(secret)"
intake_token="$(secret)"
summary="$OUT/summary.md"
: >"$summary"
fail() {
  echo "Reference run failed: $1" | tee -a "$summary" >&2
  exit 1
}

echo "Starting Forgejo with the sample repository"
# All interfaces: the agent in foreman's container reaches Forgejo through host-gateway, not 127.0.0.1 (run 43593410474).
docker run -d --name osf-reference-forgejo -p "$forge_port:3000" \
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
[ -n "${GITHUB_ACTIONS:-}" ] && echo "::add-mask::$token" && echo "::add-mask::$password"
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
cp -R "$here/factory" "$work/factory"
# The model routes of the run: every route of the reference factory goes to the one model on OpenRouter.
cat >"$work/litellm.yaml" <<EOF
model_list:
  - model_name: routes/implement
    litellm_params:
      model: openrouter/$MODEL
      api_key: os.environ/OPENROUTER_API_KEY
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
litellm_settings:
  drop_params: true
EOF
mkdir -p "$work/none"
# The e2e override needs values for Slack and the scripted agent; this run uses neither.
cat >"$work/.env" <<EOF
POSTGRES_PASSWORD=$(secret)
LITELLM_MASTER_KEY=sk-$(secret)
FOREMAN_API_TOKEN=$(secret)
INTAKE_API_TOKEN=$intake_token
GATEKEEPER_API_TOKEN=$(secret)
GATEKEEPER_SLACK_TOKEN=xoxb-unused
GATEKEEPER_SLACK_SIGNING_SECRET=unused
GATEKEEPER_SLACK_CHANNEL=C0UNUSED
FACTORY_DIR=$work/factory
E2E_SLACK_URL=http://127.0.0.1:9/unused
E2E_HARNESSES={"opencode": "npx -y @opensoftware/harness-opencode@0.3.0 run --allow read,edit,execute,search,think"}
E2E_AGENT_DIR=$work/none
E2E_HARNESS_DIR=$work/none
E2E_LITELLM_CONFIG=$work/litellm.yaml
EOF
compose() {
  docker compose --project-name osf-reference --env-file "$work/.env" \
    -f "$e2e/compose/compose.yaml" -f "$here/compose.yaml" "$@"
}
collect() {
  compose logs --no-color >"$OUT/compose.log" 2>&1 || true
  # The run's folder, transcripts and run records, which foreman keeps in its data volume.
  compose cp foreman:/home/node/data "$OUT/foreman-data" >/dev/null 2>&1 || true
  compose down -v >/dev/null 2>&1 || true
  docker rm -f osf-reference-forgejo >/dev/null 2>&1 || true
}
trap collect EXIT
compose up --detach --wait foreman intake
# Git and curl --netrc of the agent, which runs in foreman's container, push and open the pull request with the token.
printf 'machine host.docker.internal login %s password %s\n' "$owner" "$token" |
  compose exec -T foreman sh -c 'umask 077 && cat > "$HOME/.netrc"'

echo "Submitting the issue as a work item"
item="$(curl -fsS -H "authorization: Bearer $intake_token" -H 'content-type: application/json' \
  --data "$(jq -n --arg url "$issue" '{type: "task", title: "Add a function add(a, b)",
    description: "Implement the issue in the origin link.", requester: {kind: "person", id: "github:maintainer"},
    origin: {source: "forgejo", url: $url}, dedupeKey: $url}')" \
  http://127.0.0.1:8081/v1/work-items | jq -r '.workItem.id // empty')"
echo "Work item: $item" | tee -a "$summary"
[ -n "$item" ] || fail "intake answered the submission without a work item ID"

status=received
for _ in $(seq $((WAIT_SECONDS / 10))); do
  status="$(curl -fsS -H "authorization: Bearer $intake_token" "http://127.0.0.1:8081/v1/work-items/$item" | jq -r .status)"
  case "$status" in complete | failed | cancelled) break ;; esac
  sleep 10
done
echo "Work item status: $status" | tee -a "$summary"
[ "$status" = complete ] || fail "the run ended as '$status' (see compose.log and foreman-data in the artifact)"

pull="$(api "$forge/api/v1/repos/$owner/sample/pulls?state=open" | jq -r '.[0].number // empty')"
[ -n "$pull" ] || fail "the run completed, but the sample repository has no open pull request"
api "$forge/api/v1/repos/$owner/sample/pulls/$pull" | jq -r '"Pull request: \(.html_url) (\(.title))"' | tee -a "$summary"
{
  echo
  echo '```diff'
  curl -fsS -H "authorization: token $token" "$forge/api/v1/repos/$owner/sample/pulls/$pull.diff"
  echo '```'
} | tee -a "$summary"
