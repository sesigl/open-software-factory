---
covers: [docs/vision/**]
---

# The vision: what a software factory is

This repository builds the factory described in Zach Lloyd's talk *Software Engineering Is Becoming Factory
Engineering* (Warp, recorded version, 25:51;
[post on X](https://x.com/zachlloydtweets/status/2111165023238160603),
[YouTube](https://www.youtube.com/watch?v=tUPPVhBBcoM)). This page is our analysis of the talk: a paraphrase
with timestamps, not a transcript. The requirements derived from it are in
[`software-factory.feature`](software-factory.feature). The speaker sells a product in this space and says so;
the ideas here are stated without the product.

## Definition (03:31–04:13)

| Property | Meaning | Consequence |
| --- | --- | --- |
| An agentic loop | Humans and agents work together: idea or bug → triage → spec → implement → review → verify → ship → monitor → new work. Humans touch the loop at spec review, code review and product review. | The delivery loop (foreman, gatekeeper, proof) |
| Runs in the cloud | Automations cannot run on laptops, and local agents cannot be governed. | Sandboxes, central context and recording |
| Measurable and improvable | The factory itself is a system that is engineered: *factory engineering*. It must get better over time. | Factory as code, metrics, scoring, self-improvement, benchmarks |

## The talk, chapter by chapter

| Time | Chapter | What is said and shown | Adds to the blueprint |
| --- | --- | --- | --- |
| 00:00 | Agenda | What a factory is, its key characteristics, the factory as infrastructure, a working factory. Shown in one product, meant for factories built from scratch too. | Scope: concept, not vendor |
| 01:30 | Evolution of agentic development | Autocomplete → every developer runs an interactive agent on a laptop and pushes a PR → automated development. Goal: maximum business value without sloppy output. | Target state: automated, not interactive |
| 02:43 | More AI usage is not more business value | Three problems of interactive agents: people are the bottleneck; no systematic way to optimize cost and quality; no central governance. | Cloud runtime, cost metrics, governance |
| 03:12 | Local agents are insecure agents | Everyone sets up their own MCP servers; a compromise acts as the logged-in user. Answer: sandboxes. | Sandboxes, declared secrets and MCP servers |
| 03:31 | A cloud software factory | Definition above. Loop diagram with human touchpoints. Agents verify with computer use and QA, ship through CI/CD. | The delivery loop |
| 04:42 | No one size fits all | The loop differs per company and team; also for the wider product lifecycle. | Loop variants per team and product surface |
| 05:07 | Factories are infrastructure | As flexible as a cloud provider. Open (any model, any harness), adaptable (existing tools), defined in code and versioned, so versions can be tested and agents can improve the factory. | factory-spec, adapters |
| 06:19 | AI sovereignty | Keep all data that flows through the factory in your own systems; it is what improves your agents. Own compute, models, inference gateway. Open beats a walled garden. | Self-hosting, data ownership |
| 07:01 | Measurement over vibes | Ignore claims about the newest best model or harness. Run LLM-judge evals on your own sessions, use them for self-improvement, benchmark configurations on your own work instead of public benchmarks. | scorekit, observer, taskcapture |
| 07:53 | Two types of engineers | Product engineering happens through the factory, with human touchpoints. Factory engineering tunes the factory: skills, MCP servers, model mix, workflow. | Roles |
| 08:44 | Demo: agents and the foreman | One factory per product surface; a factory is a collection of agents defined in code. A foreman agent with central configuration (MCP servers, secrets, model, runtime, triggers, prompt) delegates to triage, spec, implementation and code-review agents. Configuration is read-only in the UI and managed in a Git repository. | foreman, factory-spec |
| 10:25 | Demo: work from any surface | Chat, tracker, forge, or a local coding agent. A chat request goes to the foreman, through triage, creates a tracker issue and a PR, and is verified with computer use. | intake, proof |
| 12:25 | Demo: the team in real time | All agent runs of the team are visible live, like collaborative documents for coding agents, with links back to their origin. Runs are stored automatically. | runlog, visibility |
| 13:19 | Flow and cost | Dashboard over 7 days: 21.5 human interactions per PR; median kickoff → PR 44 min, kickoff → merge 15 h, PR → first human review 2.6 h, first review → merge 27 min; 326 PRs, 189 merged; 1,791 runs (743 top-level). Cost per PR $16.42 split into compute, platform and inference; spend by source; top 20 most expensive PRs. | ledger |
| 14:06 | Scoring | LLM-as-judge over stored runs on dimensions you define, for example “redundant tests”. Sampled because it is expensive; pass/fail criteria; defined in code; trend over time. | scorekit |
| 15:22 | Self-improvement | Agents read the scores, find repeated problems (one seen 54 times) and propose changes to the factory definition as a PR with Problem, Solution and Evidence; a person merges. Proving that it works is still being worked out. | observer |
| 17:16 | Automations | Triggered work goes through the same workflow as human work: schedules, labels, PR events, CI failures, chat mentions, error-tracker webhooks. | intake, foreman |
| 17:52 | Benchmarks on your own work | Add real tasks to suites; replay them (careful with side effects); run a matrix of models and harness configurations; read a correctness-versus-cost chart (one model 94.8 % at $6.23, another about 93 % at $1.99); feed the choice into model routing. | taskcapture |
| 21:41 | The factory stack | Seven layers, see below. | Reference architecture |
| 24:38 | Results | Cost per PR from about $55 to about $15 in six weeks, PR throughput up about 40 %, lower revert rate. | Outcome targets |

## The stack (slide at about 22:15)

| Layer | Contents |
| --- | --- |
| 06 Access | Factory MCP for any coding agent, chat, tracker, forge, any device, API and SDK |
| 05 Orchestration | Native stages (triage, spec, implement, review, verify), multiple harnesses, human in the loop (live steering, handoff), automations (trigger, cron) |
| 04 Improvement | Metrics (autonomy, cost, cycle time), scorers, benchmarks, self-improvement |
| 03 Inference | Hosted multi-model, bring your own (for example Bedrock, Vertex), custom routing rules |
| 02 Compute | Sandboxes (container image, Kubernetes, any remote environment), agent runners (Mac, Linux, Windows), computer use (video, image) |
| 01 Data and context | Runs and transcripts, agent memory, artifacts (PRs, reports, attachments), MCP and internal knowledge, access control and attribution |
| 00 Factories as code | Factory definition file, agent definitions, automation definitions, launch configuration, repository configuration |

Layers 00–03 can be vendor-hosted or self-hosted.

## Metric catalogue

| Metric | Definition | Demo value |
| --- | --- | --- |
| Human interactions per PR | Human touches per merged PR; a measure of autonomy | 21.5 |
| Cycle time segments | Median kickoff → PR, kickoff → merge, PR → first human review, first review → merge | 44 min, 15 h, 2.6 h, 27 min |
| Pull requests | Opened and merged | 326 / 189 |
| Runs | Total and top-level, by agent type | 1,791 / 743 |
| Cost per PR | Attributed spend ÷ PRs; compute, platform, inference | $16.42 |
| Spend | By source, user, agent, model | $4,988.78 |
| Scorer pass rate | Share of sampled runs that pass, with trend and scorer cost | 94–99 % |
| Repeated problems | Occurrences of one failure pattern | 54 |
| Benchmark | Correctness and average cost per trial per configuration | 94.8 % / $6.23 |
| Revert rate | Share of merged changes that are reverted; the quality guardrail | “lower” |

## What the talk leaves open

These are the first places to add our own requirements.

1. How to prove that self-improvement works (sample size, when to revert a change).
2. Whether LLM judges can be trusted; calibration against human labels is not discussed.
3. How benchmark replay avoids real side effects.
4. Which change needs which human gate, and who may change the factory itself.
5. Which direction is good for human interactions per PR.
6. How specifications and acceptance criteria are written and traced.
7. Security beyond the sandbox: egress, secret rotation, prompt injection through tickets and web pages.
8. How shared cost is attributed.
9. Whether benchmarks built from past tasks overfit.
10. What the monitoring stage does beyond one error webhook.
