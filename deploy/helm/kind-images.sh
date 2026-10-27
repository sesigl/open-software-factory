#!/bin/sh
# Loads every image the chart osf uses into a kind cluster, for the chart's scenarios (ADR 0075). Compose pulls the
# images of compose.yaml and builds the module images that GHCR does not have yet.
#   deploy/helm/kind-images.sh [cluster name, default kind]
set -eu
cluster=${1:-kind}
deploy=$(cd "$(dirname "$0")/.." && pwd)
bin=$(cd "$deploy/.." && pwd)/.tools/bin
env=$(mktemp)
trap 'rm -f "$env"' EXIT
# compose.yaml refuses to run without its secrets; building needs none of them.
grep -o '\${[A-Z_]*:?' "$deploy/compose/compose.yaml" | sort -u | sed 's/^\${\(.*\):?$/\1=unused/' > "$env"
if [ -n "${OSF_BUILD_CA:-}" ]; then echo "OSF_BUILD_CA=$OSF_BUILD_CA" >> "$env"; fi
compose() { docker compose --file "$deploy/compose/compose.yaml" --env-file "$env" --profile tools "$@"; }
# The published images first; Compose builds them only when one is missing, like a pin that moved in a pull request.
compose pull --quiet --ignore-pull-failures || true
for image in $(compose config --images); do
  docker image inspect "$image" >/dev/null 2>&1 || { compose build; break; }
done
images=$("$bin/helm" template osf "$deploy/helm/osf" --set secrets.existingSecret=unused 2>/dev/null \
  | sed -n 's/^ *image: *"\{0,1\}\([^" ]*\)"\{0,1\}$/\1/p' | sort -u)
for image in $images; do
  docker image inspect "$image" >/dev/null 2>&1 || docker pull --quiet "$image"
  "$bin/kind" load docker-image --name "$cluster" "$image"
done
