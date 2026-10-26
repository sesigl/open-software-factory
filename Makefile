# The single entry point for people, agents and CI. `make help` lists the targets.
# Make holds no build logic (ADR 0010): it calls pnpm, turbo and `osf` (tools/bin/osf.ts).
# Checks are described in docs/quality/checks.md; the tooling is documented in tools/README.md.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help
MAKEFLAGS += --no-print-directory

OSF := pnpm --silent run osf
# SPEC, TRACE, STEPS and PASS (ADR 0031): spec-trace built from this checkout, with spec-trace.json.
SPEC_TRACE := node modules/spec-trace/dist/cli.js
TURBO := pnpm exec turbo run --output-logs=errors-only
export PATH := $(CURDIR)/.tools/bin:$(PATH)
export TURBO_TELEMETRY_DISABLED := 1

# Base for affected runs and for DOCS-AFFECTED, CONTRACT and ADR. CI sets OSF_BASE to the PR base.
OSF_BASE ?= $(shell git merge-base HEAD origin/main 2>/dev/null)
export OSF_BASE
AFFECTED := $(if $(OSF_BASE),--filter=...[$(OSF_BASE)])

.PHONY: help install check verify verify-static verify-tests verify-checks test-scenario smoke smoke-paid mutation next-id new-module docs docs-affected \
        agents-sync run-record

help: ## list the targets
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'

install: ## install dependencies and the pinned lychee, oasdiff, opa, temporal and nats-server binaries
	pnpm install --frozen-lockfile
	@# osf imports the libraries in packages/ that tools/ depends on: build them first.
	@$(TURBO) build --filter=@opensoftware/tools^...
	@$(OSF) install-tools

check: ## affected lint, typecheck and system tests, then the fast repository checks
	@$(TURBO) lint typecheck test:system $(AFFECTED)
	@$(TURBO) build --filter=@opensoftware/spec-trace...
	@status=0; $(SPEC_TRACE) check --only SPEC,TRACE,STEPS || status=1; $(OSF) check || status=1; exit $$status

verify: ## everything from a clean state; required before you report done
	@rm -rf reports/junit reports/coverage
	@# The repository checks run even when tests fail, so PASS can name each failing scenario.
	@status=0; $(MAKE) verify-static || status=$$?; \
	$(MAKE) verify-tests || status=$$?; \
	$(MAKE) verify-checks || status=1; exit $$status

# The three parts of `make verify`. CI runs them as parallel jobs (.github/workflows/verify.yml).
verify-static: ## part of verify: lint, typecheck and build every package without the cache
	@$(TURBO) lint typecheck build --force

# One system test suite at a time: BUDGET adds up test times, and suites that share the cores slow each other.
verify-tests: ## part of verify: the system test suites; FILTER="pkg !pkg" limits them to some packages
	@$(TURBO) test:system --concurrency=1 --continue $(foreach f,$(FILTER),--filter=$(f))

# REACH maps the coverage in reports/coverage/ to the built files, so the build comes first (cached after verify-static).
verify-checks: ## part of verify: every check, on the test results in reports/
	@$(TURBO) build
	@status=0; $(SPEC_TRACE) check || status=1; $(OSF) check --all || status=1; exit $$status

test-scenario: ## run the one system test of a scenario: make test-scenario ID=SCN-REPO-002
	@$(OSF) test-scenario $(ID)

smoke: ## the deterministic end-to-end scenarios in e2e/
	@$(TURBO) test:system --filter=./e2e

smoke-paid: ## one real-model run per harness; only when asked
	@$(TURBO) test:paid

# Stryker on the lines each module changed since OSF_BASE, then MUTATION on the reports (ADR 0037). ALL=1 mutates
# every line of every module and scores the totals, as the nightly run does. One module at a time: Stryker uses the cores.
mutation: ## mutation testing (Stryker) of the changed lines, then MUTATION; ALL=1 mutates every line
	@rm -rf reports/mutation
	@$(TURBO) mutation --concurrency=1 $(if $(ALL),,$(AFFECTED)) $(if $(ALL),-- --all)
	@$(OSF) check MUTATION $(if $(ALL),--total)

next-id: ## print the next free scenario ID: make next-id MODULE=proof (or a prefix: MODULE=REPO)
	@$(OSF) next-id $(MODULE)

new-module: ## create a module from modules/_template: make new-module NAME=x [PREFIX=X]
	@$(OSF) new-module $(NAME) $(if $(PREFIX),--prefix $(PREFIX))

docs: ## regenerate generated doc sections
	@$(OSF) docs

docs-affected: ## list hand-written docs whose covers: paths changed since OSF_BASE
	@$(OSF) docs-affected

agents-sync: ## render factory.yaml: CLAUDE.md, the MCP files and the skill links of every harness
	@pnpm --silent --filter @opensoftware/factory-spec build
	@OUTPUT=. node modules/factory-spec/dist/cli.js render --harness all

# The session folders of this checkout (ADR 0027): its Claude Code project folder and every Codex session.
RUN_SESSIONS ?= $(wildcard $(HOME)/.claude/projects/$(shell pwd | sed 's/[^a-zA-Z0-9]/-/g') $(HOME)/.codex/sessions)

run-record: ## export the run of this checkout's newest agent session to runs/<run id>.jsonl; commit it before you push
	@pnpm --silent --filter @opensoftware/runlog build
	@OUTPUT=runs node modules/runlog/dist/cli.js export --latest --per-run $(RUN_SESSIONS)
