---
status: accepted; generated-client exception superseded by 0012
date: 2026-10-19
supersedes: 0002
---

# 0009. TypeScript as the only core language

## Context

ADR 0002 chose TypeScript for tools and adapters and Python for runlog, scorekit, taskcapture, observer and the
ledger CLI. A review of every place where a Python module touches the rest of the factory found no edge that
needs Python:

| Python module in 0002 | What it depends on | Needs Python? |
| --- | --- | --- |
| runlog | harness session files and OTLP; the harness adapters (TypeScript) know the same formats | no; keeping all harness knowledge in one language is better |
| scorekit | judge calls over HTTP to the LLM gateway; Langfuse evaluators configured through its API; simple agreement statistics | no |
| ledger | SQL views on DuckDB and PostgreSQL, both available from Node | no |
| observer | model calls and a PR through the forge port; backpass is distributed through npm | no |
| taskcapture | writes Harbor task folders (files) and runs the `harbor` CLI | no, except an optional Harbor agent plugin |
| LiteLLM, Langfuse | run as services; configured by YAML or API | language-neutral |

Modules never call each other's code, so the language of one module never forces the language of another. And
system tests drive the built module from outside, so a test does not need the module's language.

Two core languages would double the infrastructure: two testkits, a Python and a TypeScript parser in the TRACE,
STEPS, ASSERT and NOSKIP checks, two lint and type stacks, two package managers, two release paths and a CI
matrix.

## Decision

- All modules, ports, adapters, the testkit and the checks are TypeScript (Node 24).
- Python is allowed only for:
  - adapters into Python-only tools, for example a Harbor agent plugin that drives our harness port
    (`adapters/harbor/`), and
  - generated client packages from `contracts/` for Python users.
- Anything else in Python needs its own ADR. Its system tests still use the TypeScript testkit through the
  module's CLI or API.
- Java and other languages appear only as generated clients.
- Module boundaries stay language-neutral: CLI, HTTP (OpenAPI), MCP, CloudEvents and files in the shared formats.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| TypeScript only | one toolchain, one testkit, one set of checks; MCP, ACP, Chat SDK and backpass are TypeScript | evaluation and data contributors often prefer Python |
| TypeScript + Python (0002) | Python's data libraries; Harbor and LiteLLM are Python | double infrastructure for no required edge |
| Python only | evaluation ecosystem | no Chat SDK, weaker MCP/ACP tooling, weaker CLI distribution |

## Prior art

Harbor ships built-in agents for Claude Code, Codex and OpenHands, so the Harbor plugin is optional. Langfuse has
a TypeScript SDK. DuckDB and PostgreSQL have mature Node drivers.

## Consequences

- Simpler T-00 and T-02; the checks parse only TypeScript.
- Revisit if scorekit or observer need real machine learning (own embedding models, clustering at scale). Then
  such code becomes a separate Python service behind an HTTP contract, with its own ADR.
