# The single entry point for people, agents and CI. `make help` lists the targets.
# Make holds no build logic (ADR 0010): it calls pnpm, turbo and `osf` (tools/bin/osf.ts).
# Checks are described in docs/quality/checks.md; the tooling is documented in tools/README.md.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help
MAKEFLAGS += --no-print-directory

OSF := pnpm --silent run osf
TURBO := pnpm exec turbo run --output-logs=errors-only
export PATH := $(CURDIR)/.tools/bin:$(PATH)
export TURBO_TELEMETRY_DISABLED := 1

# Base for affected runs and for SPECGUARD, DOCS-AFFECTED, CONTRACT and ADR. CI sets OSF_BASE to the PR base.
OSF_BASE ?= $(shell git merge-base HEAD origin/main 2>/dev/null)
export OSF_BASE
AFFECTED := $(if $(OSF_BASE),--filter=...[$(OSF_BASE)])

.PHONY: help install check verify test-scenario smoke smoke-paid mutation next-id new-module docs docs-affected \
        agents-sync

help: ## list the targets
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'

install: ## install dependencies, the pinned lychee and oasdiff binaries and the openapi-generator jar
	pnpm install --frozen-lockfile
	@$(OSF) install-tools

check: ## affected lint, typecheck and system tests, then the fast repository checks
	@$(TURBO) lint typecheck test:system $(AFFECTED)
	@$(OSF) check

verify: ## everything from a clean state; required before you report done
	@rm -rf reports/junit
	@# The repository checks run even when tests fail, so PASS can name each failing scenario.
	@status=0; $(TURBO) lint typecheck build test:system --force || status=$$?; \
	$(OSF) check --all || status=1; exit $$status

test-scenario: ## run the one system test of a scenario: make test-scenario ID=SCN-REPO-002
	@$(OSF) test-scenario $(ID)

smoke: ## the deterministic end-to-end scenarios in e2e/
	@$(TURBO) test:system --filter=./e2e

smoke-paid: ## one real-model run per harness; only when asked
	@$(TURBO) test:paid

mutation: ## nightly mutation testing (Stryker) of every package that defines a mutation script
	@$(TURBO) mutation

next-id: ## print the next free scenario ID: make next-id MODULE=proof (or a prefix: MODULE=REPO)
	@$(OSF) next-id $(MODULE)

new-module: ## create a module from modules/_template: make new-module NAME=x [PREFIX=X]
	@$(OSF) new-module $(NAME) $(if $(PREFIX),--prefix $(PREFIX))

docs: ## regenerate generated doc sections
	@$(OSF) docs

docs-affected: ## list hand-written docs whose covers: paths changed since OSF_BASE
	@$(OSF) docs-affected

agents-sync: ## link skills/ into .claude/skills/ and the other harness folders
	@$(OSF) agents-sync
