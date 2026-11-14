---
covers: [docs/vision/**]
---

# Reference: how to build a software factory that improves itself

A second reference for what a good software factory is, next to [`talk-analysis.md`](talk-analysis.md). Source: Zach
Lloyd's talk *How to Build a Software Factory That Improves Itself* (AI Engineer, 22:01;
[YouTube](https://www.youtube.com/watch?v=nKjPBAw_N_0)). This page is our analysis of the talk: a paraphrase with
timestamps, not a transcript. The timestamps come from the automatic captions and were not checked against the audio.
The speaker sells a product in this space and says so; the ideas here are stated without the product.

The talk is a shorter version of the first one and covers the same ground. This page records only what it states
differently or adds, above all the answers in its question round (18:05–21:53), which touch several points that
[`talk-analysis.md`](talk-analysis.md#what-the-talk-leaves-open) lists as open.

## What a good factory is, in one sentence

A loop in the cloud in which humans put work in and agents do the stages of the life cycle, under rules the company
defines, built so that it can be measured and improved over time (03:07–04:00). It is infrastructure to build on and
scale, not a product or an "AI teammate" (04:02–04:13).

## The talk, chapter by chapter

| Time | Chapter | What is said and shown | Relation to our blueprint |
| --- | --- | --- | --- |
| 01:12 | From interactive prompting to automated development | Most companies run interactive agents on laptops; they want automated development for the most business value at the lowest cost, governed and secure. Interactive agents are limited by the person running them, by per-person setups that hide cost, and by missing governance. | Same as the first talk, 01:30–02:43 |
| 02:21 | Local agents | A compromised local agent acts as the signed-in user; everyone configures their own MCP servers, skills and tools, so nothing can be seen or audited. Answer: sandbox the agents and move them to the cloud. | Sandboxes, declared MCP servers |
| 03:07 | A cloud software factory | Humans put work in; agents triage, write the spec with a human, implement and verify with computer use. The business defines the rules for how humans and agents interact. | The delivery loop |
| 04:02 | Infrastructure, not a teammate | Open (open-weight and frontier models, several harnesses, because the best ones keep changing), adaptable (works with existing infrastructure), defined in code. The definition names workflows, skills, MCP servers and where they run; versioning it lets you test factory versions and lets coding agents change the factory. | factory-spec, adapters |
| 05:14 | AI sovereignty | Own the data that goes in and comes out, run on your own compute, bring your own inference, any model, any harness. Large enterprises ask for this. | Self-hosting, data ownership |
| 06:01 | Measurement first, on your own data | Ignore social-media claims and public benchmarks such as SWE-bench or Terminal-Bench. Score your agents, feed the scores to agents that improve the factory, build benchmarks from your real tasks. | scorekit, observer, taskcapture |
| 06:55 | Product and factory engineering | Product engineers put work into the factory. Factory engineering, done by a platform team or by every engineer, improves skills, context and model mix. | Roles |
| 08:12 | The manager's view | How automated the factory is, cycle time as a DORA-style view, spend. Every run of every engineer and every automation is visible live with its artifacts and its conversation, and all of it is stored: "the raw material for improving" the factory. | ledger, runlog, console |
| 09:47 | Work from existing tools | Chat, tracker (Linear or Jira) and forge PR comments carry the same context; all work goes to one central place, where it is seen and recorded. | intake |
| 10:31 | The workflow as code | An orchestrator agent routes work to triage, spec, implementation or code review; the details must stay flexible. Each stage is an agent definition: secrets, MCP servers, prompt, model. A repository holds the whole factory at any point in time: agent definitions, automations, benchmarks, runtimes, skills, webhooks. | foreman, factory-spec |
| 12:01 | Scores as online evals | Agents judge stored runs with LLM-as-judge. Example scorer: redundant tests, "a common failure mode" of coding agents. Every failure is a chance to improve the system; agents grade more efficiently than people. | scorekit |
| 13:25 | Self-improvement loop | Agents aggregate failures, find patterns and propose a change to the factory definition as a PR. Example: "read more skills before implementing", seen 37 times. | observer |
| 14:42 | Benchmarks from past runs | Public benchmarks do not predict a model or harness on your own work. Add any past run to a suite, for example a suite of front-end tasks, replay it, read a cost-versus-quality chart (one model 93 % correct at about $2, another 95 % at about three times the cost) and build model routing on it. | taskcapture |
| 17:12 | The stack | Defined in code at the bottom, then data, sandboxed compute, flexible inference, improvement (benchmarks, scoring), orchestration of multi-step workflows, access from existing tools. "Something like this no matter how you approach this problem." | Same seven layers as the first talk |

## Answers from the question round

| Time | Question | Answer | Open point it addresses |
| --- | --- | --- | --- |
| 18:06 | How do you test and verify what the factory produces? | Automated work can pile up PRs. Two remedies: spec-driven development, so a change can be checked against its spec, and computer-use verification, in which agents produce evidence from the user's side that the change works; both lessen the code-review burden. | 6 (specifications and acceptance criteria); our Gherkin scenarios and proof |
| 18:50 | How do you budget for verification at the start of a project? | Measure cost per PR and the share of that cost spent on scoring and benchmarking, then extrapolate. The one idea to leave with: build something you can measure and improve in a closed loop. | 8 (cost attribution); ledger |
| 19:40 | How do you curate benchmark data? | Start by hand with a representative set of small, medium and hard tasks. Or let the factory pick interesting past sessions, because it knows all of them. | 9 (benchmarks that overfit) |
| 20:47 | How is correctness judged on the benchmark chart? | Only by LLM-as-judge today; human grading "makes total sense" and is suggested as well. Any scorer can serve as a benchmark criterion. | 2 (trusting LLM judges) |
| 21:17 | Is the platform open source, and who is it for? | Not open source, but meant to be open to existing tools. Best for teams; overkill for one person, valuable from about ten engineers. | Why this repository builds an open-source factory |

## What this adds to our requirements

1. A scorer is also a benchmark criterion: one definition grades live runs and benchmark trials.
2. Correctness on benchmarks should be calibrated with human grades, not only with an LLM judge.
3. A benchmark suite starts as a hand-picked, representative mix of small, medium and hard tasks; the factory may
   propose more from stored sessions.
4. Spec-driven development and user-side evidence (computer use, QA) are the two levers against a pile-up of PRs.
5. The share of cost spent on scoring and benchmarking is a metric of its own, next to cost per PR.
