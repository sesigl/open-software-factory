---
covers: [modules/**, adapters/**]
---

# Module tiers

| Tier | Meaning | Where it lives | Who maintains | Release |
| --- | --- | --- | --- | --- |
| Core | Every factory needs it, it defines a contract, or it guards security. | This repository | Maintainers | Together with the contracts; strict compatibility |
| Optional | First-party and useful, but a factory works without it. | This repository | Maintainers | Independent |
| Community | Extra adapters, scorer packs, stage modules, policies. | Their own repositories | Their authors | Their own; listed in the catalog when they pass the conformance kit |

## Core

| Module | Why it is core |
| --- | --- |
| contracts | The formats and APIs every module speaks |
| testkit | Every module and adapter is tested with it; it also is the conformance kit for community adapters |
| factory-spec | The definition every other module reads |
| foreman | Without it there is no delivery loop |
| gatekeeper | Human gates are a safety property, not an add-on |
| runlog | Without a record nothing can be measured or improved |
| proof | Evidence is part of the definition of done |
| Port adapters: harness `acp` (generic), sandbox `docker`, forge `github` and `forgejo`, inference `litellm`, secrets `env` and `openbao`, telemetry `otlp` | The smallest set that runs one factory end to end, and Forgejo for deterministic tests |

## Optional (first-party)

| Module | Adds |
| --- | --- |
| spec-trace | Scenario traceability for any repository (mandatory in this repository, optional for users) |
| scorekit | Scoring of agent sessions |
| ledger | Cost and flow metrics |
| observer | Self-improvement pull requests |
| taskcapture | Private benchmarks and routing rules |
| intake | Chat, tracker and monitoring entry points, Factory MCP server |
| console | Read-only web view of runs, evidence and the self-improvement inbox |
| Adapters: harness `claude-code`, `codex`, `opencode`; sandbox `kubernetes`; channel `slack`, `teams`, `github`, `linear` | Native control for the most used products beyond the generic ACP adapter |
| Install profiles: Compose, Helm chart, dashboards | Ready-made installs |

## Community

Adapters for GitLab, Bitbucket, Jira, Discord, E2B, Daytona, Modal, Goose, Aider, Vault, Infisical, Datadog and
others; scorer packs; stage modules such as security review or design review; policy packs; benchmark suites.

## Rules for promotion

- A module moves from community to optional when maintainers accept to support it and it passes every check
  in this repository.
- A module becomes core only through an ADR that shows every factory needs it.
- A community adapter gets the "verified" mark in the catalog when it passes its port's `@conformance`
  scenarios with the current testkit.
