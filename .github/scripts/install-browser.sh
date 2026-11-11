#!/usr/bin/env bash
# Installs the Playwright browser of a package's capture scenarios into $PLAYWRIGHT_BROWSERS_PATH (ADR 0029).
# Usage: install-browser.sh <package> <browser>
#
# The action capture-browser restores the browser's system packages from GitHub's cache first. Then, in this order:
#   1. the browser alone, from Playwright's own download, when it starts with the packages the runner has;
#   2. the system packages from apt's mirrors, when their hosts resolve;
#   3. the system packages from the mirror of kernel.org: Ubuntu's mirrors are sometimes out of reach from the runner.
set -euo pipefail
package=$1
browser=$2

playwright() { pnpm --filter "$package" exec playwright-core "$@"; }
starts() {
  pnpm --filter "$package" exec node -e \
    'require("playwright-core")[process.argv[1]].launch().then((b) => b.close())' "$browser" >/dev/null 2>&1
}
# The hosts of apt's sources resolve: else apt waits for each package until the job's time limit.
mirrors_resolve() {
  local host
  for host in $(grep -hoE 'https?://[^/ ]+' /etc/apt/sources.list.d/*.sources /etc/apt/sources.list 2>/dev/null \
    | sed -E 's#https?://##' | sort -u); do
    getent hosts "$host" >/dev/null || return 1
  done
}

playwright install "$browser"
if starts; then exit 0; fi

echo 'Acquire::Retries "1";' | sudo tee /etc/apt/apt.conf.d/99-osf-retries >/dev/null
if mirrors_resolve; then
  playwright install-deps "$browser"
else
  echo "::warning::apt's mirrors do not resolve; installing the system packages of $browser from the mirror of kernel.org"
  sudo sed -i -E 's#https?://(azure\.archive|archive|security)\.ubuntu\.com/ubuntu/?#http://mirrors.edge.kernel.org/ubuntu/#g' \
    /etc/apt/sources.list.d/*.sources /etc/apt/sources.list 2>/dev/null || true
  playwright install-deps "$browser"
fi
starts || { echo "::error::$browser does not start"; exit 1; }
