# The single entry point for people, agents and CI. `make help` lists the targets.
# Checks are described in docs/quality/checks.md; the tooling is documented in tools/README.md.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help
MAKEFLAGS += --no-print-directory

OSF := node tools/bin/osf.ts
TOOLS_BIN := $(CURDIR)/.tools/bin
export PATH := $(TOOLS_BIN):$(PATH)

# Base ref for SPECGUARD, DOCS-AFFECTED, CONTRACT and ADR. CI sets it to the pull request base.
OSF_BASE ?= $(shell git merge-base HEAD origin/main 2>/dev/null)
export OSF_BASE

LYCHEE_VERSION := 0.20.1
LYCHEE_SHA256 := 1dd08bb064e2114c2c9d0c9009f51577de24e805361d6332162807972d8e9474
OASDIFF_VERSION := 1.11.7
OASDIFF_SHA256 := 97f1052365f74e6fd6f4d8fa108606e09391aebb8ecbf3b5e7a4059d54327224

.PHONY: help install tools lint typecheck check test verify test-scenario smoke smoke-paid mutation \
        next-id new-module docs docs-affected agents-sync

help: ## list the targets
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'

install: tools ## install Node and Python dependencies and the pinned binaries
	pnpm install --frozen-lockfile
	uv sync --frozen

tools: $(TOOLS_BIN)/lychee $(TOOLS_BIN)/oasdiff ## download lychee and oasdiff (Linux x86_64; elsewhere put them on PATH)

$(TOOLS_BIN)/lychee:
	@mkdir -p $(TOOLS_BIN)
	@if command -v lychee >/dev/null && [ "$$(command -v lychee)" != "$@" ]; then ln -sf "$$(command -v lychee)" $@; exit 0; fi; \
	tmp=$$(mktemp -d); \
	curl -sSfL -o $$tmp/lychee.tgz https://github.com/lycheeverse/lychee/releases/download/lychee-v$(LYCHEE_VERSION)/lychee-x86_64-unknown-linux-gnu.tar.gz; \
	echo "$(LYCHEE_SHA256)  $$tmp/lychee.tgz" | sha256sum -c --quiet; \
	tar -xzf $$tmp/lychee.tgz -C $$tmp; install -m 0755 $$tmp/lychee $@; rm -rf $$tmp

$(TOOLS_BIN)/oasdiff:
	@mkdir -p $(TOOLS_BIN)
	@if command -v oasdiff >/dev/null && [ "$$(command -v oasdiff)" != "$@" ]; then ln -sf "$$(command -v oasdiff)" $@; exit 0; fi; \
	tmp=$$(mktemp -d); \
	curl -sSfL -o $$tmp/oasdiff.tgz https://github.com/oasdiff/oasdiff/releases/download/v$(OASDIFF_VERSION)/oasdiff_$(OASDIFF_VERSION)_linux_amd64.tar.gz; \
	echo "$(OASDIFF_SHA256)  $$tmp/oasdiff.tgz" | sha256sum -c --quiet; \
	tar -xzf $$tmp/oasdiff.tgz -C $$tmp; install -m 0755 $$tmp/oasdiff $@; rm -rf $$tmp

lint: ## format and lint: Biome for TypeScript, Ruff for Python
	pnpm exec biome check .
	uv run --frozen ruff check .
	uv run --frozen ruff format --check .

typecheck: ## tsc --strict and pyright
	pnpm exec tsc --noEmit -p tsconfig.json
	pnpm exec pyright

check: ## fast checks (seconds): lint and the static checks
	@pnpm exec biome check . >/dev/null || { pnpm exec biome check .; exit 1; }
	@$(OSF) check

test: ## run every system test and write JUnit results to reports/junit/
	@rm -rf reports/junit
	pnpm exec vitest run

verify: ## everything; required before you report done
	$(MAKE) lint
	$(MAKE) typecheck
	@# The checks run even when tests fail, so PASS can name each failing scenario.
	@status=0; $(MAKE) test || status=$$?; $(OSF) check --all || status=1; exit $$status

test-scenario: ## run the one system test of a scenario: make test-scenario ID=SCN-REPO-002
	@test -n "$(ID)" || { echo "Set ID, for example ID=SCN-REPO-002" >&2; exit 2; }
	pnpm exec vitest run --reporter=default -t '^$(ID)$$'

smoke: ## the deterministic end-to-end scenarios in e2e/
	@if ls e2e/system-tests/*.test.ts >/dev/null 2>&1; then pnpm exec vitest run e2e/system-tests; \
	else echo "SMOKE: no system tests in e2e/system-tests yet (TODO T-20)"; fi

smoke-paid: ## one real-model run per harness; only when asked
	@if ls e2e/paid/*.test.ts >/dev/null 2>&1; then pnpm exec vitest run e2e/paid; \
	else echo "SMOKE-PAID: no paid smoke tests yet (TODO T-20)"; fi

mutation: ## nightly mutation testing of every module that has a Stryker or mutmut config
	@found=0; \
	for dir in modules/*/ packages/*/; do \
	  if ls $$dir/stryker.config.* >/dev/null 2>&1; then found=1; (cd $$dir && pnpm exec stryker run); fi; \
	  if [ -f $$dir/pyproject.toml ] && grep -q '\[tool.mutmut\]' $$dir/pyproject.toml; then found=1; (cd $$dir && uv run mutmut run); fi; \
	done; \
	[ $$found = 1 ] || echo "MUTATION: no module has a mutation config yet"

next-id: ## print the next free scenario ID: make next-id MODULE=proof
	@$(OSF) next-id $(MODULE)

new-module: ## create a module from modules/_template: make new-module NAME=x [PREFIX=X] [LANG=ts]
	@$(OSF) new-module $(NAME) $(if $(PREFIX),--prefix $(PREFIX)) $(if $(LANG),--lang $(LANG))

docs: ## regenerate generated doc sections
	@$(OSF) docs

docs-affected: ## list hand-written docs whose covers: paths changed since OSF_BASE
	@$(OSF) docs-affected

agents-sync: ## link skills/ into .claude/skills/ and the other harness folders
	@$(OSF) agents-sync
