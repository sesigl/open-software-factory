#!/usr/bin/env bash
# The kind cluster of a tests job of verify.yml, started in the background while Node, the install and the image pulls
# run (ADR 0163, ADR 0167). kind pulls its node image from the registry, as the suite's images are pulled: a cache of
# image archives was slower than the registries (ADR 0167).
#
# Usage: kind-start.sh start [agent-sandbox]  start kind in the background, with agent-sandbox's controller when asked
#        kind-start.sh wait [agent-sandbox]   wait for that start and print its log, or start kind now when nothing
#                                             started it
#        kind-start.sh dry-run [agent-sandbox] print what start runs, without Docker or kind
#
# Each line of the background start's log carries the time it was written, so a run shows where the time goes.
set -euo pipefail
temp=${RUNNER_TEMP:-${TMPDIR:-/tmp}}
kind=.tools/bin/kind
kubeconfig=${KUBECONFIG:-$temp/kubeconfig}
status=$temp/kind-start.status
log=$temp/kind-start.log

create() {
  echo "kind: create cluster"
  KUBECONFIG=$kubeconfig "$kind" create cluster --wait 120s
  if [ "${1:-}" = agent-sandbox ]; then
    echo "kind: apply agent-sandbox"
    KUBECONFIG=$kubeconfig kubectl apply -f .tools/bin/agent-sandbox.yaml
    KUBECONFIG=$kubeconfig kubectl wait --for=condition=Available deployment --all --all-namespaces --timeout=180s
  fi
  echo "kind: ready"
}

# Each line with the time of day: the step prints the log only at its end.
stamp() {
  local line
  while IFS= read -r line; do printf '%(%T)T %s\n' -1 "$line"; done
}

start() {
  local with=${1:-}
  echo "KUBECONFIG=$kubeconfig" >> "${GITHUB_ENV:-/dev/null}"
  if [ ! -x "$kind" ]; then
    echo "kind: $kind is not there yet (no cache of the pinned tools); the cluster starts after make install"
    return 0
  fi
  echo running > "$status"
  # nohup: the cluster keeps starting while the next steps run; the status file tells wait how it ended.
  # shellcheck disable=SC2016 # the inner shell expands its own arguments
  nohup bash -c '"$0" create "$3" 2>&1 | "$0" stamp > "$1"; echo "${PIPESTATUS[0]}" > "$2"' \
    "$0" "$log" "$status" "$with" < /dev/null > /dev/null 2>&1 &
  echo "kind: the cluster starts in the background"
}

wait_for() {
  local with=${1:-}
  echo "KUBECONFIG=$kubeconfig" >> "${GITHUB_ENV:-/dev/null}"
  if [ ! -f "$status" ]; then
    create "$with"
    return
  fi
  local started=$SECONDS
  while [ "$(cat "$status")" = running ]; do sleep 1; done
  echo "kind: waited $((SECONDS - started)) s for the cluster that started in the background"
  cat "$log"
  [ "$(cat "$status")" = 0 ] || { echo "::error::kind did not start the cluster"; exit 1; }
}

dry_run() {
  echo "start: $kind create cluster --wait 120s, in the background, its log in $log with the time of each line"
  if [ "${1:-}" = agent-sandbox ]; then
    echo "start: kubectl apply -f .tools/bin/agent-sandbox.yaml, then wait until every deployment is Available"
  fi
  echo "wait: until $status holds the exit code, then print $log"
}

command=${1:-}
shift || true
case "$command" in
  start) start "$@" ;;
  create) create "$@" ;;
  stamp) stamp ;;
  wait) wait_for "$@" ;;
  dry-run) dry_run "$@" ;;
  *) echo "usage: kind-start.sh start|wait|dry-run [agent-sandbox]" >&2; exit 2 ;;
esac
