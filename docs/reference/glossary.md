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
| Agent Trace record | The lines of the files a run wrote, attributed to the agent and its model, in the open Agent Trace format. |
| Evidence bundle | The screenshots, video, traces and test results that prove a change works. |
| Scorer | An LLM-judge or code check that grades sampled runs on one dimension. |
| Score | The result of one scorer on one run. |
| Benchmark suite | A set of real tasks captured from past work, replayed to compare configurations. |
| Cell | One configuration and one model in a benchmark report, with its correctness and average cost per trial. |
| Replay | Running a captured task again with no side effects: during its run the agent reaches only the model gateway, never a real chat or forge. |
| Hidden tests | The tests of a captured pull request: the agent never sees them; they decide the task's reward. |
| Routing rule | A rule in the LLM gateway that picks a model for a class of tasks. |
| Problem | One scorer that failed many runs, recorded by observer with its count, its reasons and links to the failed runs. |
| Self-improvement | The loop that turns repeated failures into reviewed changes to the factory definition. |
| Port | An interface to an outside system. |
| Adapter | An implementation of a port for one product. |
| Library | A package in `packages/` without a `bin` that modules may depend on: shared code with no CLI and no state of its own. Its system tests import it by its package name (ADR 0037, ADR 0039). |
| Mutant | A small change Stryker makes to a module's code. A system test that fails on it detects the mutant; MUTATION scores the share detected. |
| Clone | Source code of 50 tokens or more that appears twice. DUP limits clones inside a unit and forbids them across units. |
| Layer | A named group of a module's source files in its `architecture.json`; a file imports only its own layer and the layers below it. |
| Conformance scenario | A port scenario every adapter of the port must pass. |
| Product engineer | A person who delivers product value through the factory. |
| Factory engineer | A person who improves the factory itself. |
| Drift | A difference between the factory definition and the running factory. |
