#!/bin/sh
# The factory in the folder <folder>, for gatekeeper's policy and groups, the console's pages and groups and the tools
# of factory-spec (ADR 0150). With FACTORY_REPOSITORY, git+<url>#<branch>: a clone of the newest commit of the branch,
# made again at every start. Without it: the folder <source>, FACTORY_DIR, committed into Git there, as foreman reads
# a run's factory version from Git. A private repository over HTTPS takes FACTORY_TOKEN, which reaches Git only in its
# environment, as Basic credentials of x-access-token for that URL (ADR 0142): never in a file, on a command line or
# in the clone's config. The Compose profile and the Helm chart both run this file.
# Usage: factory-repo.sh <folder> [<source>]
set -eu
cd "$1"
if [ -z "${FACTORY_REPOSITORY:-}" ]; then
  find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  cp -R "$2"/. .
  [ -d .git ] || git init -q -b main
  git add -A
  git diff --cached --quiet ||
    git -c user.name=factory -c user.email=factory@localhost commit -q -m "factory from FACTORY_DIR"
  exit 0
fi
case $FACTORY_REPOSITORY in
  git+?*) ;;
  *)
    echo "factory-repo: FACTORY_REPOSITORY is git+<url>#<branch>, like git+https://github.com/acme/factory.git#main, not $FACTORY_REPOSITORY" >&2
    exit 1
    ;;
esac
setting=${FACTORY_REPOSITORY#git+}
url=${setting%%#*}
branch=main
case $setting in *"#"?*) branch=${setting#*#} ;; esac
# The URL without a user and a password that it may carry, for the messages.
named=$(printf '%s' "$url" | sed 's|://[^/@]*@|://|')
if [ -n "${FACTORY_TOKEN:-}" ]; then
  GIT_CONFIG_COUNT=1
  GIT_CONFIG_KEY_0="http.$url.extraHeader"
  GIT_CONFIG_VALUE_0="Authorization: Basic $(printf 'x-access-token:%s' "$FACTORY_TOKEN" | base64 | tr -d '\n')"
  export GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0
fi
clone=$(mktemp -d)
if ! GIT_TERMINAL_PROMPT=0 git clone --quiet --depth 1 --branch "$branch" "$url" "$clone/factory" 2>"$clone/error"; then
  echo "factory-repo: cannot clone $branch of $named: $(cat "$clone/error"): check FACTORY_REPOSITORY and FACTORY_TOKEN" >&2
  rm -rf "$clone"
  exit 1
fi
find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -R "$clone/factory"/. .
rm -rf "$clone"
echo "factory-repo: $named at $(git rev-parse --short HEAD), the newest commit of $branch"
