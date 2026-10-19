---
covers: [docs/**, modules/*/features/**]
---

# Glossary

Use these terms in scenarios, code, UI text and docs.

| Term | Meaning |
| --- | --- |
| Factory | A closed loop of agents and people that turns work items into shipped, verified changes, declared in one factory definition. |
| Factory definition | `factory.yaml` plus prompts, skills and policies in Git; the desired state of a factory. |
| Factory version | The commit hash of the factory definition a run used. |
| Lock file | `factory.lock` next to `factory.yaml`: the exact version of each MCP server from a registry, pinned by `factory plan`. |
| Product surface | A part of a product with its own factory, for example "web" or "server". |
| Work item | One unit of requested work (idea, bug, automated trigger) as a CloudEvent. |
| Stage | One step of the delivery loop: triage, spec, implement, review, verify, ship, monitor. |
| Gate | A point where work waits for a deterministic check or a human decision. |
| Human touchpoint | A gate where a person reviews the spec, the code or the product. |
| Foreman | The orchestrator that runs the stages of a factory as durable workflows. |
| Harness | A coding-agent program that runs the inner tool loop, such as Claude Code, Codex or OpenCode. |
| Sandbox | An isolated environment in which one stage's harness runs. |
| Run | One harness session for one stage of one work item. |
| Run record | The stored transcript, trace, cost and links of a run, in OpenTelemetry form. |
| Evidence bundle | The screenshots, video, traces and test results that prove a change works. |
| Scorer | An LLM-judge or code check that grades sampled runs on one dimension. |
| Score | The result of one scorer on one run. |
| Benchmark suite | A set of real tasks captured from past work, replayed to compare configurations. |
| Routing rule | A rule in the LLM gateway that picks a model for a class of tasks. |
| Self-improvement | The loop that turns repeated failures into reviewed changes to the factory definition. |
| Port | An interface to an outside system. |
| Adapter | An implementation of a port for one product. |
| Layer | A named group of a module's source files in its `architecture.json`; a file imports only its own layer and the layers below it. |
| Conformance scenario | A port scenario every adapter of the port must pass. |
| Product engineer | A person who delivers product value through the factory. |
| Factory engineer | A person who improves the factory itself. |
| Drift | A difference between the factory definition and the running factory. |
| Automation | A trigger in the factory definition that starts work without a person asking: an event filter such as `forgejo.issue.labeled(auto-implement)`, or a schedule. |
| Webhook | A forge's call to a URL when an event happens; `factory apply` registers one per repository for the automations. |
