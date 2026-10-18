---
covers: [AGENTS.md, docs/**]
---

# Principles

Two sets. The **factory principles** say what the product must be; they come from the vision. The
**engineering principles** say how we build it; each has a practice and an automatic check, because a principle
without a check is a wish. When a requirement or a design question is not covered elsewhere, decide with these.

## Factory principles

| # | Principle | Statement | Why | Source |
| --- | --- | --- | --- | --- |
| P1 | Close the loop | Work flows from intake through triage, spec, build, review, verification and shipping to monitoring, and monitoring creates new work. | An open pipeline cannot learn. | 03:43, 04:13–04:42 |
| P2 | Run in the cloud, not on laptops | The factory, its agents and its automations run in a central, always-on environment. | Laptops bottleneck work on people and cannot be governed. | 02:48, 03:49 |
| P3 | Declare the factory in code | Agents, prompts, MCP servers, skills, secret references, repositories, models, runners, automations and scorers are versioned files. The UI only shows them. | Only code can be tested, rolled back, reviewed and changed by agents through a PR. | 05:51–06:19, 09:35, 21:56 |
| P4 | Open and pluggable | Any model, harness, inference provider or compute. Every layer can be replaced alone. | The best model and harness change every month. | 05:23, 06:51, 23:07 |
| P5 | Meet people where they work | Work enters and is followed from the chat, tracker, forge and devices people already use. Everything is API-driven. | Adoption depends on fitting existing tools. | 05:39, 10:31–11:10, 24:16 |
| P6 | Centralize context, record everything | Every run stores transcript, trace, artifacts and links to origin, issue and PR. | Visibility, scoring, benchmarks and self-improvement start from the record. | 11:03, 12:56–13:19, 22:25 |
| P7 | Own your data | Run data stays in systems the company controls. | It is the asset that improves the agents. | 06:19–06:55 |
| P8 | Measure, don't trust vibes | Decide models, harnesses and workflows with scores and benchmarks from your own work. | Public benchmarks do not measure your codebase. | 07:08–07:53, 21:16 |
| P9 | Humans at the gates, agents in between | Explicit human touchpoints (spec, code, product) and deterministic gates; agents route work inside the allowed paths. | Determinism gives control; intelligence gives speed. | 04:26–04:36, 23:41 |
| P10 | Prove the work | A change is done when the factory shows evidence that it works. | Without proof, review becomes trust. | 04:36, 12:01 |
| P11 | Sandbox and govern centrally | Isolated sandboxes, only declared secrets and MCP servers, role-based access, every action attributed. | A compromised local agent acts as its user; a sandboxed one cannot. | 03:08–03:31, 22:45 |
| P12 | One workflow, many triggers | Work from people and from automations goes through the same declared workflow or a declared variant. | One path to measure, govern and improve. | 17:22–17:58 |
| P13 | Cost is a first-class metric | Know cost per PR, attributed by source, person, agent and model; trade quality against cost explicitly. | Otherwise spend grows faster than value. | 13:47–14:06, 20:51 |
| P14 | Guard quality while you speed up | Every speed or cost gain is read next to a quality signal such as revert rate. | Faster slop is not progress. | 02:28, 25:19–25:39 |
| P15 | Improve the factory through the factory | Repeated failures become PRs to the factory definition with problem, solution and evidence, merged by a person. | The factory improves without a person finding every problem. | 15:28–17:11 |
| P16 | Templates, not one process | The loop is a template each team and product surface adapts. | One fixed process fits no real company. | 04:42–05:07, 09:16 |
| P17 | Two jobs | Product engineers deliver through the factory; factory engineers tune it. | Improving the machine needs an owner. | 07:53–08:44 |

## Engineering principles

| Principle | Practice | Automatic check |
| --- | --- | --- |
| Enforce by script, not prose | Every rule that matters runs as code: gates, merges, releases, metric events. | Review rejects a rule written only as text where a check could exist. |
| Specify first, from the outside | Every behavior is a Gherkin scenario; exactly one system test per scenario proves it from outside the module. | SPEC, TRACE, STEPS, PASS, BOUNDARY ([checks](quality/checks.md)) |
| Useful alone | Each module has a five-minute quick start without a server or a sibling module; it is scenario `-001`. | The quick-start scenario runs on every change. |
| Formats over code | Modules share only versioned schemas and events. | ISOLATION, CONTRACT |
| Ports with conformance | Every outside system sits behind a port; each port has `@conformance` scenarios. | An adapter is listed only when it passes them. |
| Adopt before build | Every new module, dependency or service records the prior art that was checked. | ADR check rejects an empty Prior art section. |
| Open standards at every boundary | MCP, ACP, OpenAPI, CloudEvents, OTLP. | Interfaces are generated from TypeSpec, OpenAPI and AsyncAPI; review rejects custom wire formats. |
| Record and correlate everything | Every run carries `run.id`, `work_item.id`, `factory.version`. | Ingest rejects records without them. |
| Least privilege by default | No secrets in sandboxes; egress and MCP allowlists per agent. | Policy tests; a prompt-injection task in every benchmark suite. |
| Humans at the gates | Gate policy as code by risk class. | Merge blocked without a signed approval record. |
| Evidence or it didn't happen | No PR is ready without an evidence bundle for its scenarios. | proof and spec-trace are required checks. |
| Measure before you change | Every factory change shows a score or benchmark comparison. | Merge rule on factory PRs. |
| Cost is visible and bounded | Budget per run and per work item at the LLM gateway. | Gateway stops at budget; ledger alerts over target. |
| Every change can be undone | Versions are immutable; rollback is a revert. | Runs reference the version hash; rollback drill each release. |
| Deterministic tests | No real network, model, clock or randomness in system tests. | NOREAL |
| Docs are part of done | Reference docs generated; hand-written docs declare what they cover. | DOCS-GEN, DOCS-AFFECTED |
| Run it on ourselves first | Every release runs in our own factory first. | Release gate: time in the dogfood environment with no new failing scorer. |
