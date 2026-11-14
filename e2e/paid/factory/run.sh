#!/usr/bin/env bash
# The paid factory run (ADR 0128, T-21 foreman): the factory of this checkout implements one issue of this repository
# on github.com, labeled `factory`, with a paid model, and opens its pull request on the branch factory/issue-<n>. The
# modules run from the e2e image of this workspace (ADR 0076); LiteLLM sends the model calls to OpenRouter with a
# budget of 0.50 USD for the run. A person reviews the pull request before it is merged (AGENTS.md).
#
# Needs: Docker with Compose, the image osf-e2e:workspace (node e2e/scripts/images.ts), OPENROUTER_API_KEY, ISSUE
# (the issue's number), FACTORY_GITHUB_TOKEN (a token that may push a branch and open a pull request in REPOSITORY;
# in the workflow the job's GITHUB_TOKEN), REPOSITORY (owner/name, default $GITHUB_REPOSITORY).
# Optional: MODEL (default the model of weekly-paid.yml), OUT (default ./factory-run), WAIT_SECONDS (default 2700).
# It succeeds when the run completed and the branch factory/issue-<n> has an open pull request; it writes the summary
# to $OUT/summary.md and the run's files to $OUT.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../lib.sh
. "$here/../lib.sh"
paid_out factory-run
: "${ISSUE:?set ISSUE to the number of an issue labeled factory}"
: "${FACTORY_GITHUB_TOKEN:?set FACTORY_GITHUB_TOKEN}"
REPOSITORY="${REPOSITORY:-${GITHUB_REPOSITORY:?set REPOSITORY to owner/name}}"
export WAIT_SECONDS="${WAIT_SECONDS:-2700}"
mask "$FACTORY_GITHUB_TOKEN"
case "$ISSUE" in '' | *[!0-9]*) fail "ISSUE must be the number of an issue, not '$ISSUE'" ;; esac
github() {
  curl -fsS -H "authorization: Bearer $FACTORY_GITHUB_TOKEN" -H 'accept: application/vnd.github+json' \
    "https://api.github.com/repos/$REPOSITORY/$1"
}

issue_json="$(github "issues/$ISSUE")" || fail "issue #$ISSUE of $REPOSITORY cannot be read"
[ "$(jq -r '.pull_request // empty' <<<"$issue_json")" = "" ] || fail "#$ISSUE is a pull request, not an issue"
[ "$(jq -r .state <<<"$issue_json")" = open ] || fail "issue #$ISSUE is not open"
jq -e '[.labels[].name] | index("factory")' <<<"$issue_json" >/dev/null ||
  fail "issue #$ISSUE does not carry the label factory"
title="$(jq -r .title <<<"$issue_json")"
url="$(jq -r .html_url <<<"$issue_json")"
echo "Issue: $url ($title)" | tee -a "$summary"

echo "Starting the factory"
paid_start osf-factory-run
paid_netrc github.com x-access-token "$FACTORY_GITHUB_TOKEN" api.github.com

echo "Submitting the issue as a work item"
paid_submit "$title" github "$url"

owner="${REPOSITORY%%/*}"
pull="$(github "pulls?state=open&head=$owner:factory/issue-$ISSUE" | jq -r '.[0].html_url // empty')"
[ -n "$pull" ] || fail "the run completed, but the branch factory/issue-$ISSUE has no open pull request"
echo "Pull request: $pull" | tee -a "$summary"
echo "A pull request that GITHUB_TOKEN opened starts no workflow: a maintainer pushes to it or re-runs its checks." |
  tee -a "$summary"
