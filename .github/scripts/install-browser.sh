#!/usr/bin/env bash
# Installs the Playwright browser of a package's capture scenarios into $PLAYWRIGHT_BROWSERS_PATH (ADR 0029).
# Usage: install-browser.sh <package> <browser>
#
# The action capture-browser restores the browser's system packages from GitHub's cache first, and apt-mirror.sh
# points apt at a mirror that resolves. Then the browser comes from Playwright's own download; when it does not start
# with the packages the runner has, its system packages come from apt.
set -euo pipefail
package=$1
browser=$2

playwright() { pnpm --filter "$package" exec playwright-core "$@"; }
starts() {
  pnpm --filter "$package" exec node -e \
    'require("playwright-core")[process.argv[1]].launch().then((b) => b.close())' "$browser" >/dev/null 2>&1
}

playwright install "$browser"
if starts; then exit 0; fi
echo "::warning::$browser does not start with the runner's packages; installing its system packages with apt"
playwright install-deps "$browser"
starts || { echo "::error::$browser does not start"; exit 1; }
