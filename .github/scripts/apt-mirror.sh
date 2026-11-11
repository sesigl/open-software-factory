#!/usr/bin/env bash
# Makes apt fail fast, and switches its sources to the mirror of kernel.org when their hosts do not resolve: Ubuntu's
# mirrors are sometimes out of reach from the runner, and apt then waits for each package until the job's time limit.
set -euo pipefail
echo 'Acquire::Retries "1";' | sudo tee /etc/apt/apt.conf.d/99-osf-retries >/dev/null
sources=$(ls /etc/apt/sources.list.d/*.sources /etc/apt/sources.list 2>/dev/null || true)
[ -n "$sources" ] || exit 0
# shellcheck disable=SC2086
for host in $(grep -hoE 'https?://[^/ ]+' $sources | sed -E 's#https?://##' | sort -u); do
  if ! getent hosts "$host" >/dev/null; then
    echo "::warning::$host does not resolve; apt uses the mirror of kernel.org"
    # shellcheck disable=SC2086
    sudo sed -i -E 's#https?://(azure\.archive|archive|security)\.ubuntu\.com/ubuntu/?#http://mirrors.edge.kernel.org/ubuntu/#g' $sources
    exit 0
  fi
done
