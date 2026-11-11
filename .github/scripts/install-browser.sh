#!/usr/bin/env bash
# Installs the Playwright browser of a package's capture scenarios into $PLAYWRIGHT_BROWSERS_PATH (ADR 0029).
# Usage: install-browser.sh <package> <browser>
#
# Ubuntu's mirrors are sometimes out of reach from the runner. Then, in this order:
#   1. the browser with its system packages, as Playwright installs them;
#   2. the browser alone, from Playwright's own download: the runner image has the libraries of Chrome, so it starts;
#   3. the system packages from another mirror, when the browser does not start without them.
set -euo pipefail
package=$1
browser=$2

playwright() { pnpm --filter "$package" exec playwright-core "$@"; }
starts() {
  pnpm --filter "$package" exec node -e \
    'require("playwright-core")[process.argv[1]].launch().then((b) => b.close())' "$browser"
}

# The hosts of apt's sources resolve: else apt waits for each package until the job's time limit.
mirrors_resolve() {
  local host
  for host in $(grep -hoE 'https?://[^/ ]+' /etc/apt/sources.list.d/*.sources /etc/apt/sources.list 2>/dev/null \
    | sed -E 's#https?://##' | sort -u); do
    getent hosts "$host" >/dev/null || return 1
  done
}

echo 'Acquire::Retries "1";' | sudo tee /etc/apt/apt.conf.d/99-osf-retries >/dev/null
if mirrors_resolve && playwright install --with-deps "$browser"; then exit 0; fi
echo "::warning::the system packages of $browser did not install; trying the browser alone"
playwright install "$browser"
if starts; then exit 0; fi

echo "::warning::$browser does not start without its system packages; trying the mirror of kernel.org"
sudo sed -i -E 's#https?://(azure\.archive|archive|security)\.ubuntu\.com/ubuntu/?#http://mirrors.edge.kernel.org/ubuntu/#g' \
  /etc/apt/sources.list.d/*.sources /etc/apt/sources.list 2>/dev/null || true
playwright install-deps "$browser"
starts
