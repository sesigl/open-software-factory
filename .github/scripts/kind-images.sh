#!/usr/bin/env bash
# The kind cluster of a tests job of verify.yml and the images it pulls, from GitHub's cache when main saved them
# (ADR 0163). Only images that the job pulls from a registry go into the cache: the kind node image that the pinned kind
# names, and the suite's `pull` list of .github/test-suites.yml. The module images that deploy's test:system builds
# from the commit (ADR 0156) are never saved. A miss, or an archive that does not load, falls back to the registry.
#
# Usage: kind-images.sh keys [image ...]    the cache keys, as lines for $GITHUB_OUTPUT
#        kind-images.sh start [agent-sandbox]
#                                           start kind in the background, from the cached node image when there,
#                                           with agent-sandbox's controller when asked
#        kind-images.sh wait                wait for that start, or start kind now when nothing started it
#        kind-images.sh pull [image ...]    in the background: load the cached images, pull the others
#        kind-images.sh save [image ...]    write the archives of the images that the cache missed; node=saved and
#                                           pull=saved go to $GITHUB_OUTPUT
#        kind-images.sh dry-run [image ...] print the keys and the archives, without Docker or kind
#
# The archives are in $KIND_IMAGES (default $RUNNER_TEMP/kind-images): node/node.tar and pull/pull.tar, which the job
# restores and saves with actions/cache. KIND_NODE_HIT and KIND_PULL_HIT ("true") tell save what the cache had.
set -euo pipefail
temp=${RUNNER_TEMP:-${TMPDIR:-/tmp}}
dir=${KIND_IMAGES:-$temp/kind-images}
kind=.tools/bin/kind
kubeconfig=${KUBECONFIG:-$temp/kubeconfig}
status=$temp/kind-start.status
log=$temp/kind-start.log

# The node image that the pinned kind creates its clusters from: kind names it in its binary, with its digest.
node_image() {
  grep -aom1 'kindest/node:v[0-9.]*@sha256:[0-9a-f]\{64\}' "$kind"
}

# A key from the names of the images: a new pin is a new key.
digest() { printf '%s\n' "$@" | sort -u | sha256sum | cut -c1-16; }

keys() {
  local node
  node=$(node_image)
  echo "node=$node"
  echo "node-key=kind-node-${node##*@sha256:}"
  if [ "$#" -gt 0 ]; then echo "pull-key=kind-pull-$(digest "$@")"; fi
}

# docker load does not keep the digest of an image, only its tag: the cached node image is started by its tag, which
# the key names with its digest.
create() {
  local node image
  node=$(node_image)
  image=$node
  if [ -f "$dir/node/node.tar" ] && docker load --quiet --input "$dir/node/node.tar"; then image=${node%@*}; fi
  echo "kind: node image $image"
  KUBECONFIG=$kubeconfig "$kind" create cluster --image "$image" --wait 120s
  # With agent-sandbox, its controller starts too; the action kind-agent-sandbox applies the manifest again, which
  # then changes nothing.
  if [ "${1:-}" = agent-sandbox ]; then
    KUBECONFIG=$kubeconfig kubectl apply -f .tools/bin/agent-sandbox.yaml
    KUBECONFIG=$kubeconfig kubectl wait --for=condition=Available deployment --all --all-namespaces --timeout=180s
  fi
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
  nohup bash -c '"$0" create "$3" > "$1" 2>&1; echo $? > "$2"' "$0" "$log" "$status" "$with" < /dev/null > /dev/null 2>&1 &
  echo "kind: the cluster starts in the background"
}

wait_for() {
  echo "KUBECONFIG=$kubeconfig" >> "${GITHUB_ENV:-/dev/null}"
  if [ ! -f "$status" ]; then
    create
    return
  fi
  local started=$SECONDS
  while [ "$(cat "$status")" = running ]; do sleep 1; done
  echo "kind: waited $((SECONDS - started)) s for the cluster that started in the background"
  cat "$log"
  [ "$(cat "$status")" = 0 ] || { echo "::error::kind did not start the cluster"; exit 1; }
}

# The pids of the pulls go to $RUNNER_TEMP/pulls, which the step "Wait for the image pulls" waits for. The names of the
# images that came from a registry or the cache, or that the runner had before any build, go to pulled: save writes
# only those, so an image that deploy's test:system bakes because its pull failed stays out of the cache.
pull() {
  : > "$temp/pulled"
  nohup "$0" fetch "$@" < /dev/null > /dev/null 2>&1 &
  echo $! >> "$temp/pulls"
}

fetch() {
  if [ -f "$dir/pull/pull.tar" ]; then docker load --quiet --input "$dir/pull/pull.tar" > /dev/null || true; fi
  local pids=() image pid
  for image in "$@"; do
    if docker image inspect "$image" > /dev/null 2>&1; then
      echo "$image" >> "$temp/pulled"
      continue
    fi
    (docker pull --quiet "$image" > /dev/null 2>&1 && echo "$image" >> "$temp/pulled") &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do wait "$pid" || true; done
}

save() {
  local node
  node=$(node_image)
  if [ "${KIND_NODE_HIT:-}" != true ] && docker image inspect "$node" > /dev/null 2>&1; then
    mkdir -p "$dir/node"
    docker tag "kindest/node@${node##*@}" "${node%@*}"
    docker save --output "$dir/node/node.tar" "${node%@*}"
    echo "kind: saved ${node%@*}, $(du -h "$dir/node/node.tar" | cut -f1)"
    echo "node=saved" >> "${GITHUB_OUTPUT:-/dev/null}"
  fi
  if [ "${KIND_PULL_HIT:-}" = true ] || [ "$#" -eq 0 ]; then return 0; fi
  # Every image of the list, or none: an image that the job did not pull (a bake, a failed pull) stays out of the cache.
  local missing
  missing=$(comm -23 <(printf '%s\n' "$@" | sort -u) <(sort -u "$temp/pulled"))
  if [ -n "$missing" ]; then
    echo "kind: not saved, these images did not come from their registry: $missing"
    return 0
  fi
  mkdir -p "$dir/pull"
  docker save --output "$dir/pull/pull.tar" "$@"
  echo "kind: saved $# images, $(du -h "$dir/pull/pull.tar" | cut -f1)"
  echo "pull=saved" >> "${GITHUB_OUTPUT:-/dev/null}"
}

dry_run() {
  keys "$@"
  echo "start: $kind create cluster --image $(node_image) --wait 120s, or by its tag from $dir/node/node.tar"
  echo "pull: docker load $dir/pull/pull.tar, then docker pull each image that Docker does not have: $*"
}

command=${1:-}
shift || true
case "$command" in
  keys) keys "$@" ;;
  start) start "$@" ;;
  create) create "$@" ;;
  wait) wait_for ;;
  pull) pull "$@" ;;
  fetch) fetch "$@" ;;
  save) save "$@" ;;
  dry-run) dry_run "$@" ;;
  *) echo "usage: kind-images.sh keys|start|wait|pull|save|dry-run [image ...]" >&2; exit 2 ;;
esac
