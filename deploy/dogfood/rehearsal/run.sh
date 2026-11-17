#!/usr/bin/env bash
# The rehearsal on GitHub (T-95, ADR 0173): the six stages of this repository's factory (deploy/dogfood/factory/) run on
# a scratch repository on GitHub with the testkit's scripted agent, so no model is called. The modules run from the e2e
# image of this checkout (ADR 0076), which holds the scripted agent at /opt/osf/harness-agent.ts. The agents push and
# open the pull request with REHEARSAL_TOKEN; gatekeeper asks on the pull request and foreman reads its checks with
# REHEARSAL_SERVER_TOKEN, another identity, so that the approver's /approve is not gatekeeper's own comment.
#
# Needs: Docker with Compose, the image osf-e2e:workspace (node e2e/scripts/images.ts), Node 24 and this checkout's
# node_modules. The scratch repository holds the seed of deploy/dogfood/rehearsal/seed/.
#   REHEARSAL_REPOSITORY    the scratch repository, <owner>/<name>; never this repository
#   REHEARSAL_TOKEN         a token of the scratch repository only, for the agents and the issue (see deploy/README.md)
#   REHEARSAL_SERVER_TOKEN  a token of another identity, like the workflow's GITHUB_TOKEN, for gatekeeper and foreman
#   REHEARSAL_APPROVER      the GitHub login whose /approve counts: the only member of "maintainers"
# Optional: REHEARSAL_GATE (person or token, default person), REHEARSAL_ISSUE (an open issue's number),
# REHEARSAL_WAIT_MS (default 3600000), OUT (default ./rehearsal). It writes $OUT/summary.md and the run's files to $OUT.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
: "${REHEARSAL_REPOSITORY:?set REHEARSAL_REPOSITORY}" "${REHEARSAL_TOKEN:?set REHEARSAL_TOKEN}"
: "${REHEARSAL_SERVER_TOKEN:?set REHEARSAL_SERVER_TOKEN}" "${REHEARSAL_APPROVER:?set REHEARSAL_APPROVER}"
OUT="$(mkdir -p "${OUT:-rehearsal}" && cd "${OUT:-rehearsal}" && pwd)"
work="$(mktemp -d)"
# osf works on the repository of its working folder: this checkout.
osf() { (cd "$root" && node tools/bin/osf.ts "$@"); }

# The factory and the scripted agent's turns; it refuses this repository before anything starts.
osf rehearsal factory "$work" --repository "$REHEARSAL_REPOSITORY" --approver "$REHEARSAL_APPROVER" >/dev/null
# The container's user writes the agent's log next to its script.
mkdir -p "$work/none" && chmod 777 "$work/harness"

# Random values of this run only; none of them outlives it.
secret() { od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; }
intake_token="$(secret)" foreman_token="$(secret)" gatekeeper_token="$(secret)" webhook_secret="$(secret)"
[ -n "${GITHUB_ACTIONS:-}" ] && for value in "$intake_token" "$foreman_token" "$gatekeeper_token" "$webhook_secret"; do
  echo "::add-mask::$value"
done
# The e2e override needs values for Slack; the rehearsal asks on the pull request only, so none of them is called.
cat >"$work/.env" <<EOF
POSTGRES_PASSWORD=$(secret)
LITELLM_MASTER_KEY=sk-$(secret)
FOREMAN_API_TOKEN=$foreman_token
INTAKE_API_TOKEN=$intake_token
GATEKEEPER_API_TOKEN=$gatekeeper_token
OSF_OPENBAO_UNSEAL_KEY=$(secret)
OSF_OPENBAO_ROOT_TOKEN=$(secret)
OSF_OPENBAO_CONSOLE_TOKEN=$(secret)
OSF_OPENBAO_EGRESS_TOKEN=$(secret)
GATEKEEPER_SLACK_TOKEN=xoxb-unused
GATEKEEPER_SLACK_SIGNING_SECRET=unused
GATEKEEPER_FORGE_TOKEN=$REHEARSAL_SERVER_TOKEN
FOREMAN_FORGE_TOKEN=$REHEARSAL_SERVER_TOKEN
GH_TOKEN=$REHEARSAL_TOKEN
INTAKE_WEBHOOK_SECRET=$webhook_secret
FACTORY_DIR=$work/factory
FACTORY_GIT_NAME=factory
FACTORY_GIT_EMAIL=factory@example.invalid
E2E_SLACK_URL=http://127.0.0.1:9/unused
E2E_HARNESSES={"acp": "harness-acp run -- node /opt/osf/harness-agent.ts $work/harness/script.json $work/harness/log.jsonl"}
E2E_AGENT_DIR=$work/none
E2E_HARNESS_DIR=$work/harness
E2E_LITELLM_CONFIG=$root/deploy/compose/litellm/config.yaml
EOF
compose() {
  docker compose --project-name osf-rehearsal --env-file "$work/.env" -f "$root/e2e/compose/compose.yaml" "$@"
}
collect() {
  compose logs --no-color >"$OUT/compose.log" 2>&1 || true
  # The run's folder, transcripts and run records, which foreman keeps in its data volume, and the agent's log.
  compose cp foreman:/home/node/data "$OUT/foreman-data" >/dev/null 2>&1 || true
  cp "$work/harness/log.jsonl" "$OUT/agent-log.jsonl" 2>/dev/null || true
  compose down -v >/dev/null 2>&1 || true
  # A command's output in the agent's log or a transcript could hold a token: none leaves this machine in a file.
  for token in "$REHEARSAL_TOKEN" "$REHEARSAL_SERVER_TOKEN"; do
    grep -rlF "$token" "$OUT" 2>/dev/null | while read -r file; do sed -i "s|$token|***|g" "$file"; done
  done
  rm -rf "$work"
}
trap collect EXIT

echo "Starting the factory"
compose up --detach --wait foreman intake gatekeeper

echo "Rehearsing on $REHEARSAL_REPOSITORY"
INTAKE_URL=http://127.0.0.1:8081 INTAKE_API_TOKEN="$intake_token" INTAKE_WEBHOOK_SECRET="$webhook_secret" \
  FOREMAN_URL=http://127.0.0.1:8083 FOREMAN_API_TOKEN="$foreman_token" \
  GATEKEEPER_URL=http://127.0.0.1:8082 GATEKEEPER_API_TOKEN="$gatekeeper_token" \
  osf rehearsal run --repository "$REHEARSAL_REPOSITORY" --out "$OUT" --gate "${REHEARSAL_GATE:-person}" \
  ${REHEARSAL_ISSUE:+--issue "$REHEARSAL_ISSUE"}
