# The shared part of the paid runs (ADR 0128): reference/run.sh and factory/run.sh source it. It starts the e2e
# project from the workspace image with a factory folder and LiteLLM in front of OpenRouter, gives the agent a forge
# credential through ~/.netrc in foreman's container, submits a work item to intake and waits for its end.
#
# The sourcing script sets `here` (its own folder) before it sources this file. Every value made here is random and
# lives only as long as the run.
# shellcheck shell=bash

e2e="$(cd "$here/../.." && pwd)"
: "${OPENROUTER_API_KEY:?set OPENROUTER_API_KEY}"
MODEL="${MODEL:-deepseek/deepseek-v4.1-flash-1017}"
work="$(mktemp -d)"

secret() { od -An -N16 -tx1 /dev/urandom | tr -d ' \n'; }
intake_token="$(secret)"

# paid_out <default folder>: sets OUT to an absolute folder and empties its summary.
paid_out() {
  OUT="$(mkdir -p "${OUT:-$1}" && cd "${OUT:-$1}" && pwd)"
  summary="$OUT/summary.md"
  : >"$summary"
}

fail() {
  echo "Paid run failed: $1" | tee -a "$summary" >&2
  exit 1
}

# mask <value>...: hides each value in the log of GitHub Actions.
mask() {
  [ -n "${GITHUB_ACTIONS:-}" ] || return 0
  local value
  for value in "$@"; do echo "::add-mask::$value"; done
}

compose() {
  docker compose --project-name "$project" --env-file "$work/.env" \
    -f "$e2e/compose/compose.yaml" -f "$here/compose.yaml" "$@"
}

# The sourcing script may define paid_cleanup, which runs after the project is down.
collect() {
  compose logs --no-color >"$OUT/compose.log" 2>&1 || true
  # The run's folder, transcripts and run records, which foreman keeps in its data volume.
  compose cp foreman:/home/node/data "$OUT/foreman-data" >/dev/null 2>&1 || true
  compose down -v >/dev/null 2>&1 || true
  if declare -F paid_cleanup >/dev/null; then paid_cleanup; fi
}

# paid_start <project>: starts foreman and intake with the factory of $here/factory; routes/implement goes to MODEL.
paid_start() {
  project="$1"
  cp -R "$here/factory" "$work/factory"
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
  # The e2e override needs values for Slack and the scripted agent; the paid runs use neither.
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
  trap collect EXIT
  compose up --detach --wait foreman intake
}

# paid_netrc <machine> <login> <password> [<machine>...]: Git and curl --netrc of the agent, which runs in foreman's
# container, push and open the pull request with it. The value goes through stdin, never through an argument of
# docker or a file of the host.
paid_netrc() {
  local login="$2" password="$3" machine
  for machine in "$1" "${@:4}"; do
    printf 'machine %s login %s password %s\n' "$machine" "$login" "$password"
  done | compose exec -T foreman sh -c 'umask 077 && cat > "$HOME/.netrc"'
}

# paid_submit <title> <source> <issue url>: submits the issue as a work item and waits for its end; it fails unless
# the work item is complete.
paid_submit() {
  local item status=received
  item="$(curl -fsS -H "authorization: Bearer $intake_token" -H 'content-type: application/json' \
    --data "$(jq -n --arg title "$1" --arg source "$2" --arg url "$3" '{type: "task", title: $title,
      description: "Implement the issue in the origin link.", requester: {kind: "person", id: "github:maintainer"},
      origin: {source: $source, url: $url}, dedupeKey: $url}')" \
    http://127.0.0.1:8081/v1/work-items | jq -r '.workItem.id // empty')"
  echo "Work item: $item" | tee -a "$summary"
  [ -n "$item" ] || fail "intake answered the submission without a work item ID"
  for _ in $(seq $((${WAIT_SECONDS:-1200} / 10))); do
    status="$(curl -fsS -H "authorization: Bearer $intake_token" "http://127.0.0.1:8081/v1/work-items/$item" | jq -r .status)"
    case "$status" in complete | failed | cancelled) break ;; esac
    sleep 10
  done
  echo "Work item status: $status" | tee -a "$summary"
  [ "$status" = complete ] || fail "the run ended as '$status' (see compose.log and foreman-data in the artifact)"
}
