# Open Software Factory

A family of independent open-source tools that together form a **software factory**: a closed loop in which
people and coding agents turn ideas and bug reports into shipped, verified changes, in the cloud, measured and
improving itself over time.

Each tool solves one problem on its own and connects to the others only through open formats. Where a good
open-source project already exists, the factory adopts it and builds only the adapter.

> Status: **phase 0, the foundation.** The repository tooling and its checks exist ([`tools/`](tools/README.md));
> no tool module is built yet. This repository holds the vision, the architecture, the quality system, the agent
> rules and the work plan. Start with [`TODO.md`](TODO.md).

## Start here

| You want to | Read |
| --- | --- |
| Understand what a software factory is and why | [`docs/vision/talk-analysis.md`](docs/vision/talk-analysis.md) |
| See the requirements of the whole factory | [`docs/vision/software-factory.feature`](docs/vision/software-factory.feature) (82 scenarios) |
| Know the principles every decision follows | [`docs/principles.md`](docs/principles.md) |
| See the tools and how they connect | [`docs/architecture/components.md`](docs/architecture/components.md) |
| Understand adapters, factory-as-code, loops and protocols | [`docs/architecture/internals.md`](docs/architecture/internals.md) |
| Know the technology choices | [`docs/architecture/stack.md`](docs/architecture/stack.md) |
| Know how quality is proven | [`docs/quality/testing-strategy.md`](docs/quality/testing-strategy.md), [`docs/quality/checks.md`](docs/quality/checks.md) |
| Start building a module | [`TODO.md`](TODO.md), then [`AGENTS.md`](AGENTS.md) |
| Find a decision and its reason | [`docs/decisions/`](docs/decisions/) |

## The tools

| Tool | Useful alone as | Tier |
| --- | --- | --- |
| `factory-spec` | One agent configuration, rendered for every harness; `plan` and `apply` for the whole factory | core |
| `foreman` | Runs the declared stages as durable workflows with gates | core |
| `gatekeeper` | Rule-based human approvals in chat or the forge | core |
| `runlog` | Every agent session as a standard OpenTelemetry run record | core |
| `proof` | Evidence (screenshots, video, test results) on every pull request | core |
| `spec-trace` | Gherkin scenario ↔ test ↔ pull request traceability in CI | optional |
| `scorekit` | Calibrated LLM-judge scorers for coding-agent sessions | optional |
| `ledger` | Cost per pull request and flow metrics | optional |
| `taskcapture` | Private benchmarks from merged pull requests, routing rules from results | optional |
| `observer` | Repeated failures become reviewed pull requests to the factory | optional |
| `intake` | One inbox for work from chat, trackers, forges and monitoring; Factory MCP server | optional |

Plus `contracts` and `testkit` (core), adapters per port, and the `open-software-factory` distribution
(Docker Compose and Helm).

## Our own numbers

ledger shows what this repository's pull requests cost and how they flow, from the run records in `runs/` priced at
list price and the pull requests on GitHub. The workflow [`ledger-dashboard.yml`](.github/workflows/ledger-dashboard.yml)
builds the page every night and publishes it on Vercel ([ADR 0044](docs/decisions/0044-ledger-dogfood.md)):
[the ledger dashboard](https://project-ia65q.vercel.app).

scorekit judges the same runs every night with each scorer of its pack, for example whether an agent claimed success
without running the checks. The workflow [`scores.yml`](.github/workflows/scores.yml) writes the pass rate per scorer
into the summary of each run: [the latest scores](https://github.com/sesigl/open-software-factory/actions/workflows/scores.yml)
([ADR 0077](docs/decisions/0077-paid-dogfood.md)).

## Working on this repository

Every change, by a person or an agent, follows [`AGENTS.md`](AGENTS.md): Gherkin scenario first, exactly one
outside-in system test per scenario, no unit tests by default, deterministic checks, docs in the same change.
Claude Code also reads [`CLAUDE.md`](CLAUDE.md).

## License

[Apache-2.0](LICENSE)
