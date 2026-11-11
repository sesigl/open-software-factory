#!/usr/bin/env bash
# Makes apt fail fast, and switches it to the mirror of kernel.org when one of its mirrors does not resolve: Ubuntu's
# mirrors are sometimes out of reach from the runner, and apt then waits for each package until the job's time limit.
# The runner image names its mirrors in a file that its sources point to with "mirror+file:".
set -euo pipefail
echo 'Acquire::Retries "1";' | sudo tee /etc/apt/apt.conf.d/99-osf-retries >/dev/null

sources=()
for file in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources /etc/apt/sources.list.d/*.list; do
  [ -f "$file" ] && sources+=("$file")
done
[ "${#sources[@]}" -gt 0 ] || exit 0
# The active entries only, not the comments.
entries=$(grep -hE '^[[:space:]]*(URIs:|deb )' "${sources[@]}" || true)
files=("${sources[@]}")
for list in $(printf '%s\n' "$entries" | grep -oE 'mirror\+file:[^ ]+' | sed 's#mirror+file:##' | sort -u); do
  [ -f "$list" ] && files+=("$list") && entries+=$'\n'$(grep -vE '^[[:space:]]*#' "$list")
done

for host in $(printf '%s\n' "$entries" | grep -oE 'https?://[^/ ]+' | sed -E 's#https?://##' | sort -u); do
  if ! timeout 5 getent hosts "$host" >/dev/null; then
    echo "::warning::$host does not resolve; apt uses the mirror of kernel.org"
    sudo sed -i -E 's#https?://(azure\.archive|archive|security)\.ubuntu\.com/ubuntu/?#http://mirrors.edge.kernel.org/ubuntu/#g' \
      "${files[@]}"
    exit 0
  fi
done
