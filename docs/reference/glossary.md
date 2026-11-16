---
covers: [docs/**, modules/*/features/**]
---

# Glossary

Use these terms in scenarios, code, UI text and docs.

| Term | Meaning |
| --- | --- |
| Factory | A closed loop of agents and people that turns work items into shipped, verified changes, declared in one factory definition. |
| Factory definition | `factory.yaml` plus prompts, skills and policies in Git; the desired state of a factory. |
| Skill | A folder with a `SKILL.md` in the Agent Skills format: front matter with its name, the folder's name, and a description of what it does and when to use it, then short instructions, with details in files beside it. An agent names its skills in `factory.yaml`; the skill's `metadata` names the secrets and hosts it needs, which `factory lint` asks the agent to declare (ADR 0140). |
| Factory version | The commit hash of the factory definition a run used; the foreman refuses a factory folder with changes that are not committed (ADR 0110). |
| Lock file | `factory.lock` next to `factory.yaml`: the exact version of each MCP server from a registry and of each adapter, and the commit and the hash of the files of each skill of another Git repository, pinned by `factory plan` (ADR 0146). |
| Compose profile | `deploy/compose/`: the factory with all its services on one machine, started with one `docker compose up` (ADR 0074). |
| Helm chart | `deploy/helm/osf/`: the factory on Kubernetes for platform teams, installed with one `helm install`; PostgreSQL, NATS and Temporal are in it or the team's own (ADR 0075). |
| Reference factory | The factory definition in `deploy/compose/factory/` that the Compose profile runs unless `FACTORY_DIR` names another. |
| Product surface | A part of a product with its own factory, for example "web" or "server". |
| Work item | One unit of requested work (idea, bug, automated trigger) as a CloudEvent. |
| Dedupe key | The key that makes requests one work item: intake keeps one work item per key and lists every request that sent it. |
| Stage | One step of the delivery loop: triage, spec, implement, review, verify, ship, monitor. A stage runs one agent, or with `wait: true` only waits for its checks, evidence and gate (ADR 0107). |
| Gate | A point where work waits for a deterministic check or a human decision. |
| Approval record | What gatekeeper writes when a gate is decided: the request, the policy, who decided, what and when; signed with Ed25519 when `GATEKEEPER_SIGNING_KEY` is set, unsigned without it. |
| Outbox | A table where a server writes its events in the same transaction as the change they report; a relay publishes them to NATS later, so no event is lost (ADR 0003, ADR 0048). |
| Human touchpoint | A gate where a person reviews the spec, the code or the product. |
| Take over | A person ends the running stage's turn and goes on with the work in the run's folder; a hand back lets the run go on from there (ADR 0070). |
| Foreman | The orchestrator that runs the stages of a factory as durable workflows. |
| Harness | A coding-agent program that runs the inner tool loop, such as Claude Code, Codex or OpenCode. |
| Harness adapter | A program that runs one harness behind the harness port: it speaks ACP on stdio to its client and adds the tool allowlist, cancel within 5 seconds and the transcript export (ADR 0050). |
| Harness proxy | The library `@opensoftware/harness-proxy` that every harness adapter runs its agent behind: it passes ACP on, applies the allowlist and the cancel deadline, records each session and exports it as a run record (ADR 0052). |
| Sandbox | An isolated environment in which one stage's harness runs. |
| Sandbox spec | The input of a sandbox adapter's `create`: template, CPU, memory, egress allowlist, variables, secret references, MCP servers with their tools (ADR 0054) and the labels by which its client finds it (ADR 0158). |
| Egress proxy | The proxy that every request leaving a sandbox passes: it refuses hosts outside the allowlist, swaps secret placeholders for the real values and allows only declared MCP tools (iron-proxy, ADR 0054). |
| Secret placeholder | The value a sandbox holds in place of a secret, `osf-secret-placeholder-<NAME>`; worthless outside the sandbox's egress proxy. |
| Run | The foreman's pass over one work item through the stages of its workflow, as one Temporal workflow. A failed or cancelled run runs again as a new run (ADR 0105). |
| Session | One harness session: the inner loop of one agent in one stage of a run. |
| Run record | The stored record of one session: its transcript, trace, cost and links in OpenTelemetry form, with the ID of the run it belongs to (`osf.run.id`). The name stays for the contract `run-record`. |
| Agent Trace record | The lines of the files a session wrote, attributed to the agent and its model, in the open Agent Trace format. |
| Evidence bundle | The screenshots, video, traces and test results that prove a change works. |
| Scorer | An LLM-judge or code check that grades sampled run records on one dimension. |
| Score | The result of one scorer on one run record. |
| Benchmark suite | A set of real tasks captured from past work, replayed to compare configurations. |
| Cell | One configuration and one model in a benchmark report, with its correctness and average cost per trial. |
| Replay | Running a captured task again with no side effects: during the replay the agent reaches only the model gateway, never a real chat or forge. |
| Hidden tests | The tests of a captured pull request: the agent never sees them; they decide the task's reward. |
| Routing rule | A rule in the LLM gateway that picks a model for a class of tasks. |
| Routing alias | The model name an agent calls, such as `routes/triage`; the inference gateway's config routes it to a model of a provider (ADR 0056). |
| Effort level | How much an agent's model thinks before it answers: `low`, `medium`, `high`, `xhigh` or `max`. Every agent declares it; each harness adapter maps it to its product's own setting (ADR 0078). |
| Run key | The key a run calls the inference gateway with: its spend rows name the run, and the gateway refuses its calls over the run's budget (ADR 0056). The same run gets the same key, and the key is revoked when the run ended (ADR 0108). |
| Dead letter | An event a module's consumer failed on 5 times, kept on `osf.dead.<consumer>.>` in the stream `OSF`; the module's health check fails while one waits, and `intake resend` or `foreman resend` sends it again (ADR 0116). |
| Delivery | One webhook request a forge sent, kept as its headers and its body as it arrived, so its signature can be checked; the forge port's `event` turns it into a `pr.*` CloudEvent (ADR 0057). |
| Merge rules | What a branch requires before a pull request merges into it: checks that passed and a number of approvals; the forge port's `protect` sets them and `rules` reads them (ADR 0057, ADR 0136). |
| Merge when green | The forge's own merge of a pull request once the checks its merge rules require pass: GitHub's auto-merge, Forgejo's merge when checks succeed; the forge port's `merge --when-green` (ADR 0136). |
| Channel | A chat where people talk with the factory, such as Slack or the conversation of a GitHub pull request; a channel adapter turns its messages into work items and decisions (ADR 0059). |
| Thread | One conversation in a channel, named by Vercel Chat SDK's thread ID, for example `slack:C0WEB:1767225600.000001`; the factory replies in the thread of the work item it came from. |
| Approval card | A message in a thread that asks a person a question with choices, such as `approve` and `reject`; the person's choice is a decision with their identity (ADR 0059). |
| Problem | One scorer that failed many run records, recorded by observer with its count, its reasons and links to the failed run records. |
| Self-improvement inbox | The console's page `/inbox`: observer's open proposals, the pull requests from `observer/` branches, with their age and the state "needs review", "approved" or "changes requested" from the forge port's `prs` (ADR 0073). |
| Self-improvement | The loop that turns repeated failures into reviewed changes to the factory definition. |
| Module | One tool of the factory in `modules/<name>/`, with its own scenarios, `AGENTS.md`, version and release. A module never imports another module. |
| Unit | What a check measures one at a time: a module, a library in `packages/`, an adapter or `tools/`. DUP, MUTATION and BUDGET each have a limit per unit. |
| Suite | A group of packages in `.github/test-suites.yml` whose system tests run together on one CI runner; each package with system tests is in exactly one suite. |
| Port | An interface to an outside system. |
| Adapter | An implementation of a port for one product. |
| Library | A package in `packages/` without a `bin` that modules may depend on: shared code with no CLI and no state of its own. Its system tests import it by its package name (ADR 0037, ADR 0039). |
| Mutant | A small change Stryker makes to a module's code. A system test that fails on it detects the mutant; MUTATION scores the share detected. |
| Clone | Source code of 50 tokens or more that appears twice. DUP limits clones inside a unit and forbids them across units. |
| Layer | A named group of a module's source files in its `architecture.json`; a file imports only its own layer and the layers below it. |
| Conformance scenario | A port scenario every adapter of the port must pass. |
| System test | The one test of an implemented scenario: it drives the built module or adapter from outside, with fakes for every outside system, and is deterministic. The kinds of tests are in `docs/quality/testing-strategy.md`. |
| Smoke scenario | A scenario of `e2e/features/` that runs the whole factory on the Compose profile, with fakes at its edges. |
| Shared start | One start of a slow system under test, such as the Compose profile, that scenarios tagged with the same `@shared=<name>` share because they only read it. Each keeps its own test and result (ADR 0157). |
| Scenario Outline | A scenario with an `Examples` table: one ID and one test for a family of cases with the same steps, where only the literals differ (ADR 0157). |
| Live test | A test against a real, paid outside service, without fakes: the paid smoke run `SMOKE-PAID`. It is no system test, and no check counts it. |
| Product engineer | A person who delivers product value through the factory. |
| Factory engineer | A person who improves the factory itself. |
| Drift | A difference between the factory definition and the running factory. |
| Access file | The file in the factory's Git repository that lists the people who may sign in to the factory UI and their roles (`member`, `factory-engineer`, `admin`). |
| Person proof | A short-lived token, signed by the console, that proves to foreman, intake or gatekeeper which person acts in one call; the module's API token alone can no longer name a person (ADR 0151). |
| Change | An edit of the factory made in the factory UI: a pull request on the factory's repository that names the person and merges when its checks are green (ADR 0130). |
| Island | A part of a server-rendered page that runs script in the browser, such as a live state; no feature depends on one. |
| Page scenario | A UI scenario whose test reads the console's HTML over HTTP by role and name, without a browser; the default kind. |
| Journey scenario | A UI scenario whose test runs one main flow of a person across pages in Chromium. |
| Island scenario | A UI scenario whose test runs one island as a whole on its page of the workbench, in Chromium. |
| Workbench | The static site of plain Astro pages in `packages/ui`, one page per island and state, where island scenarios run (ADR 0152). |
