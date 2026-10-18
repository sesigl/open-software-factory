# Software Factory blueprint, derived from Zach Lloyd (Warp), "Software Engineering Is Becoming Factory Engineering",
# recorded talk, 25:51. Every scenario carries:
#   @source=<mm:ss>   where the talk says or shows it (several tags when several moments support it)
#   @evidence=spoken  said in the talk
#   @evidence=screen  visible on a slide or in the product demo, not said
#   @evidence=derived not stated; a requirement that the talk implies or needs, marked so it can be challenged
# Identifiers follow ^SCN-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}$ so they can move into specs/features/ later.

@context=factory-loop @owner=factory-engineering
Feature: The factory loop
  A software factory is a closed agentic loop in which people and agents work together:
  work enters, is triaged, specified, implemented, reviewed, verified, shipped and monitored,
  and monitoring feeds new work back into the start of the loop.

  Rule: Work enters the loop from people and from production signals

    @scenario_id=SCN-FACTORY-LOOP-001 @status=planned @evidence=spoken @source=04:13
    Scenario: A person submits a new product idea
      Given a factory for the product surface "web app"
      When a product engineer submits the idea "Export reports as CSV" from a connected surface
      Then the factory creates exactly one work item for the idea
      And the work item enters the "triage" stage

    @scenario_id=SCN-FACTORY-LOOP-002 @status=planned @evidence=screen @source=03:40
    Scenario: A bug report enters the same loop as an idea
      Given a factory for the product surface "web app"
      When a user reports the bug "Export button does nothing on Safari"
      Then the factory creates a work item of type "bug"
      And the work item follows the same loop as a product idea

    @scenario_id=SCN-FACTORY-LOOP-003 @status=planned @evidence=screen @source=03:40 @source=04:42 @source=17:30
    Scenario: Monitoring feeds new work back to the start of the loop
      Given the factory watches production error reports
      When a new fatal error is reported for a shipped change
      Then the factory creates a work item that links the error report and the change
      And the work item enters the "triage" stage

  Rule: Each stage has a defined owner and hands its result to the next stage

    @scenario_id=SCN-FACTORY-LOOP-004 @status=planned @evidence=screen @source=04:19 @source=09:58
    Scenario: Triage classifies new work and sets its task state
      Given a new work item in the "triage" stage
      When the triage agent finishes
      Then the work item has a type, a priority and a task state
      And the work item is routed to the next stage that its type requires

    @scenario_id=SCN-FACTORY-LOOP-005 @status=planned @evidence=spoken @source=04:26
    Scenario: The spec agent writes a specification and drives its approval
      Given a triaged work item that needs a specification
      When the spec agent finishes a draft specification
      Then the specification is attached to the work item
      And a human is asked to review the specification

    @scenario_id=SCN-FACTORY-LOOP-006 @status=planned @evidence=spoken @source=04:32
    Scenario: The implementation agent implements, validates and updates code changes
      Given a work item with an approved specification
      When the implementation agent finishes
      Then a pull request exists for the work item
      And the pull request records which checks the agent ran and their results

    @scenario_id=SCN-FACTORY-LOOP-007 @status=planned @evidence=spoken @source=04:32 @source=09:58
    Scenario: The code review agent reviews the pull request and routes findings
      Given an open pull request created by the factory
      When the code review agent reviews it
      Then each finding is routed either back to rework or to a human for resolution
      And a human can be asked to review the code

    @scenario_id=SCN-FACTORY-LOOP-008 @status=planned @evidence=spoken @source=04:36 @source=12:01
    Scenario: Verification uses computer use and produces evidence
      Given a pull request that changes user-visible behavior
      When the verification step runs
      Then an agent operates the running product through computer use
      And screenshots or a video of the verified behavior are attached to the run

    @scenario_id=SCN-FACTORY-LOOP-009 @status=planned @evidence=spoken @source=04:36
    Scenario: The change ships through the existing CI/CD pipeline
      Given a reviewed and verified pull request
      When the change is merged
      Then it ships through the company's CI/CD pipeline
      And the monitoring stage starts to watch the shipped change

    @scenario_id=SCN-FACTORY-LOOP-010 @status=planned @evidence=screen @source=03:40
    Scenario: A human reviews the product, not only the code
      Given a shipped change
      When the change reaches the "reviewing the product" touchpoint
      Then a human judges whether the product outcome is useful
      And the judgment is stored with the work item

  Rule: The loop is a template, not one fixed process

    @scenario_id=SCN-FACTORY-LOOP-011 @status=planned @evidence=spoken @source=04:42
    Scenario: Two teams run different variants of the loop
      Given team "Payments" requires a human spec review
      And team "Docs" skips the spec stage
      When both teams submit work
      Then each work item follows the loop variant of its team

    @scenario_id=SCN-FACTORY-LOOP-012 @status=planned @evidence=spoken @source=05:02 @source=09:16
    Scenario: A factory serves the wider product lifecycle
      Given a factory named "Marketing factory"
      When a marketing request is submitted
      Then the request follows the loop that the marketing factory defines

    @scenario_id=SCN-FACTORY-LOOP-013 @status=planned @evidence=spoken @source=09:16
    Scenario: There is one factory per product surface
      Given the product surfaces "server", "web" and "mobile"
      When the company sets up its factories
      Then each product surface has its own factory definition
      And a person can see all factories in one place


@context=factory-runtime @owner=platform-team
Feature: Cloud execution, sandboxes and governance
  A software factory runs in the cloud, because automation cannot run on laptops,
  and every agent runs in a sandbox under one central layer of governance.

  Rule: The factory runs in the cloud

    @scenario_id=SCN-FACTORY-RUNTIME-001 @status=planned @evidence=spoken @source=03:49
    Scenario: Automations run while every engineer's laptop is off
      Given no engineer is online
      When a scheduled automation becomes due
      Then the factory runs it in the cloud

    @scenario_id=SCN-FACTORY-RUNTIME-002 @status=planned @evidence=spoken @source=11:03
    Scenario: All factory context is in one central place
      Given work that started in Slack and continued in Linear
      When a person opens the run in the factory
      Then the person sees the full context of both conversations

  Rule: Agents run in sandboxes, never as the logged-in user

    @scenario_id=SCN-FACTORY-RUNTIME-003 @status=planned @evidence=spoken @source=03:18 @source=03:26
    Scenario: A compromised agent cannot act as a human user
      Given an agent run that is compromised through a malicious input
      When the agent tries to use credentials
      Then it has only the scoped credentials of its sandbox
      And it cannot use the credentials of any logged-in person

    @scenario_id=SCN-FACTORY-RUNTIME-004 @status=planned @evidence=screen @source=22:45
    Scenario: Each run gets an isolated sandbox with declared resources
      Given an agent definition that declares a container image and CPU, memory and disk limits
      When a run of that agent starts
      Then the run executes in a new sandbox built from that image with those limits

    @scenario_id=SCN-FACTORY-RUNTIME-005 @status=planned @evidence=spoken @source=22:55
    Scenario: Sandboxes are available on more than one platform
      Given a task that must build a macOS application
      When the task starts
      Then the factory runs it on a macOS runner
      And a Linux task in the same factory runs on a Linux runner

  Rule: Secrets, tools and MCP servers are governed centrally

    @scenario_id=SCN-FACTORY-RUNTIME-006 @status=planned @evidence=spoken @source=09:54
    Scenario: An agent receives only the secrets its definition declares
      Given the foreman agent declares the secret "LINEAR_TOKEN"
      And it does not declare the secret "STRIPE_KEY"
      When a foreman run starts
      Then the run can read "LINEAR_TOKEN"
      And the run cannot read "STRIPE_KEY"

    @scenario_id=SCN-FACTORY-RUNTIME-007 @status=planned @evidence=spoken @source=03:18 @source=09:54
    Scenario: MCP servers are configured once, centrally
      Given the factory declares the MCP servers each agent may use
      When an agent tries to call an MCP server that its definition does not declare
      Then the call is refused and recorded

  Rule: Every action is attributed and access is role-based

    @scenario_id=SCN-FACTORY-RUNTIME-008 @status=planned @evidence=screen @source=12:36 @source=22:20
    Scenario: Every run is attributed to a person or a trigger and a source
      Given a run started from a Slack message by "Varun"
      Then the run records "Varun" as requester and "Slack" as source

    @scenario_id=SCN-FACTORY-RUNTIME-009 @status=planned @evidence=derived @source=22:20
    Scenario: Only authorized roles can change a factory
      Given a person without the role "factory-engineer"
      When the person tries to change the factory definition
      Then the change is refused


@context=factory-as-code @owner=factory-engineering
Feature: Factories as code
  The factory is declared in code and versioned. Everything else (testing versions,
  rolling back, self-improvement) depends on this.

  Rule: The factory definition is declarative and complete

    @scenario_id=SCN-FACTORY-CODE-001 @status=planned @evidence=spoken @source=05:51 @source=09:54 @source=21:56
    Scenario: The definition declares every part of the factory
      Given a factory definition file
      Then it declares the agents and their prompts
      And it declares the MCP servers, skills and secrets of each agent
      And it declares the repositories each agent operates on
      And it declares the model and the runtime of each agent
      And it declares the automations that trigger work
      And it declares the scorers and benchmarks

    @scenario_id=SCN-FACTORY-CODE-002 @status=planned @evidence=screen @source=09:35
    Scenario: The factory UI shows configuration read-only
      Given the factory definition is managed in a Git repository
      When a person opens an agent configuration in the factory UI
      Then the configuration is read-only
      And the UI links to the file and the branch where the change must be made

  Rule: Every change is versioned, testable and reversible

    @scenario_id=SCN-FACTORY-CODE-003 @status=planned @evidence=spoken @source=06:01
    Scenario: A change to the factory is a versioned commit
      When a person changes the model of the triage agent
      Then the change exists as a commit in the factory repository
      And runs record which factory version they ran on

    @scenario_id=SCN-FACTORY-CODE-004 @status=planned @evidence=spoken @source=06:07 @source=22:05
    Scenario: A new factory version is tested before it replaces the current one
      Given factory version "v2" changes the implementation prompt
      When the benchmark suite runs on "v1" and "v2"
      Then the results of both versions can be compared before "v2" is released

    @scenario_id=SCN-FACTORY-CODE-005 @status=planned @evidence=spoken @source=22:05
    Scenario: A bad factory version is rolled back
      Given factory version "v3" increased the failure rate
      When a factory engineer rolls back to "v2"
      Then new runs use "v2"

    @scenario_id=SCN-FACTORY-CODE-006 @status=planned @evidence=spoken @source=15:16
    Scenario: Scorers are defined in code
      When a factory engineer adds the scorer "Redundant tests"
      Then its judge prompt, sampling rate and pass criterion exist in the factory repository


@context=factory-openness @owner=platform-team
Feature: Open and pluggable infrastructure
  The factory is infrastructure, as flexible as a cloud provider: any model, any harness,
  any inference provider, any compute, and the company's existing tools.

  Rule: Models and harnesses are interchangeable

    @scenario_id=SCN-FACTORY-OPEN-001 @status=planned @evidence=spoken @source=05:23 @source=09:58
    Scenario: The model of one agent changes without changing other agents
      Given the triage agent uses model "A" and the implementation agent uses model "B"
      When a factory engineer sets the triage agent to model "C"
      Then the triage agent uses model "C"
      And the implementation agent still uses model "B"

    @scenario_id=SCN-FACTORY-OPEN-002 @status=planned @evidence=screen @source=23:54
    Scenario Outline: An agent runs on the harness its definition declares
      Given an agent definition with the harness "<harness>"
      When a run of that agent starts
      Then the run uses "<harness>"

      Examples:
        | harness     |
        | Warp        |
        | Claude Code |
        | Codex       |

  Rule: Inference is pluggable

    @scenario_id=SCN-FACTORY-OPEN-003 @status=planned @evidence=spoken @source=06:51 @source=23:07
    Scenario: The company brings its own inference gateway
      Given the company routes model calls through its own gateway on "Bedrock"
      When an agent calls a model
      Then the call goes through the company gateway

    @scenario_id=SCN-FACTORY-OPEN-004 @status=planned @evidence=spoken @source=23:11
    Scenario: An open-weight or fine-tuned model is used
      Given the company has a fine-tuned model
      When a factory engineer assigns it to the triage agent
      Then the triage agent uses the fine-tuned model

  Rule: The factory adapts to existing tools and infrastructure

    @scenario_id=SCN-FACTORY-OPEN-005 @status=planned @evidence=spoken @source=05:39
    Scenario: The factory uses the company's existing tracker, chat and code forge
      Given the company uses Jira, Microsoft Teams and GitLab
      When the factory is set up
      Then work is tracked in Jira, discussed in Teams and reviewed in GitLab

    @scenario_id=SCN-FACTORY-OPEN-006 @status=planned @evidence=spoken @source=06:46
    Scenario: The factory runs on the company's own compute
      Given the company requires that code never leaves its cloud account
      When the factory is installed in that account
      Then sandboxes, run data and inference stay in that account


@context=factory-data @owner=platform-team
Feature: Data, context and sovereignty
  Run data is the raw material of improvement. The company records it completely
  and keeps it in its own systems.

  Rule: Every run is recorded completely

    @scenario_id=SCN-FACTORY-DATA-001 @status=planned @evidence=spoken @source=13:06 @source=22:28
    Scenario: A run stores its transcript, trace and artifacts
      When an agent run ends
      Then its full transcript and tool trace are stored
      And its artifacts are stored, for example pull requests, reports, screenshots and videos

    @scenario_id=SCN-FACTORY-DATA-002 @status=planned @evidence=spoken @source=12:56
    Scenario: A run links back to where the work started
      Given a run started from a Slack thread
      When a person opens the run
      Then the person can open the original Slack thread

    @scenario_id=SCN-FACTORY-DATA-003 @status=planned @evidence=spoken @source=11:49
    Scenario: A run links to the issue and pull requests it created
      Given a run that created a Linear issue and a pull request
      Then the run shows links to both
      And a person can continue the work from the Linear issue

  Rule: Context flows in from internal knowledge and agent memory

    @scenario_id=SCN-FACTORY-DATA-004 @status=planned @evidence=spoken @source=22:25
    Scenario: Agents read internal knowledge through declared MCP servers and APIs
      Given the factory declares the internal knowledge source "engineering wiki"
      When an agent needs a design rule
      Then the agent can read it from the engineering wiki

    @scenario_id=SCN-FACTORY-DATA-005 @status=planned @evidence=spoken @source=22:40
    Scenario: Agents keep memory between runs
      Given an earlier run learned that "the staging database resets nightly"
      When a later run needs that fact
      Then the agent can retrieve it from agent memory

  Rule: The company owns its factory data

    @scenario_id=SCN-FACTORY-DATA-006 @status=planned @evidence=spoken @source=06:25
    Scenario: Run data stays in company-controlled storage
      When runs are stored
      Then transcripts, traces and artifacts are stored in storage the company controls
      And the data is available to the company's scorers, benchmarks and self-improvement


@context=factory-access @owner=platform-team
Feature: Access points
  People and systems put work into the factory from wherever they already work.
  The factory is API-driven, and its own UI is only one surface.

  Rule: Every surface reaches the same factory workflow

    @scenario_id=SCN-FACTORY-ACCESS-001 @status=planned @evidence=spoken @source=10:31 @source=24:16
    Scenario Outline: Work is submitted from <surface>
      When a person submits work from "<surface>"
      Then the work reaches the foreman agent of the right factory
      And it follows the same workflow as work from any other surface

      Examples:
        | surface                                  |
        | Slack                                    |
        | Microsoft Teams                          |
        | Linear                                   |
        | Jira                                     |
        | GitHub                                   |
        | GitLab                                   |
        | a local coding agent through Factory MCP |
        | the factory web UI                       |
        | a mobile device                          |

    @scenario_id=SCN-FACTORY-ACCESS-002 @status=planned @evidence=spoken @source=24:22
    Scenario: A team builds its own UI on the factory API
      Given a team builds an internal tool on the factory API
      When the tool submits work and reads run status
      Then the tool has the same abilities as the factory's own UI

    @scenario_id=SCN-FACTORY-ACCESS-003 @status=planned @evidence=spoken @source=10:38
    Scenario: The factory's own chat UI is optional
      Given a team works only in Slack
      Then the team can submit, follow and finish work without opening the factory UI


@context=factory-orchestration @owner=factory-engineering
Feature: Orchestration
  A foreman agent receives work and delegates it through the stages. Deterministic
  and human gates guard the stages; agents add intelligent routing between them.

  Rule: A foreman agent receives all work and delegates it

    @scenario_id=SCN-FACTORY-ORCH-001 @status=planned @evidence=spoken @source=09:42 @source=10:10
    Scenario: The foreman delegates work to stage agents
      Given work arrives at the factory
      When the foreman agent handles it
      Then the foreman dispatches the triage, spec, implementation and code review agents as the workflow requires

    @scenario_id=SCN-FACTORY-ORCH-002 @status=planned @evidence=screen @source=16:27
    Scenario: An agent starts sub-agents only with declared permission
      Given the triage agent does not declare permission to start sub-agents
      When the triage agent tries to start a research sub-agent
      Then the platform refuses to start it
      And the refusal is visible in the run trace

  Rule: Human gates and deterministic gates guard the stages; agents route intelligently

    @scenario_id=SCN-FACTORY-ORCH-003 @status=planned @evidence=spoken @source=23:41
    Scenario: Work waits at a human gate until a human approves
      Given the workflow requires human approval of the specification
      When the spec agent finishes
      Then the work stops at the gate
      And implementation starts only after a human approves

    @scenario_id=SCN-FACTORY-ORCH-004 @status=planned @evidence=spoken @source=23:41
    Scenario: A deterministic gate blocks shipping when checks fail
      Given a pull request whose required CI checks fail
      Then the factory does not ship the change

    @scenario_id=SCN-FACTORY-ORCH-005 @status=planned @evidence=spoken @source=23:48
    Scenario: An agent routes work intelligently inside the allowed paths
      Given the workflow allows small bug fixes to skip the spec stage
      When triage classifies a work item as a small bug fix
      Then the work goes directly to implementation

  Rule: Humans can steer and take over

    @scenario_id=SCN-FACTORY-ORCH-006 @status=planned @evidence=screen @source=21:56
    Scenario: A human steers a running agent
      Given an implementation run in progress
      When a human sends the instruction "use the existing date helper"
      Then the running agent receives the instruction and continues

    @scenario_id=SCN-FACTORY-ORCH-007 @status=planned @evidence=screen @source=21:56
    Scenario: A human takes over a run
      Given an implementation run in progress
      When a human takes over the run
      Then the human continues from the run's current state and context

  Rule: Run states are explicit

    @scenario_id=SCN-FACTORY-ORCH-008 @status=planned @evidence=screen @source=12:36
    Scenario: Every run has one visible state
      Then every run is in exactly one of the states "running", "complete", "failed", "blocked" or "cancelled"
      And a person can filter runs by state


@context=factory-automation @owner=factory-engineering
Feature: Automations
  Work also enters through automated triggers, and that work uses the same workflow,
  or a declared variant of it, as work from people.

  Rule: Automated triggers feed the factory workflow

    @scenario_id=SCN-FACTORY-AUTO-001 @status=planned @evidence=spoken @source=17:22 @source=17:43
    Scenario Outline: The trigger "<trigger>" starts the automation "<automation>"
      Given the automation "<automation>" is enabled with the trigger "<trigger>"
      When "<trigger>" happens
      Then the factory starts a run of "<automation>" through its declared workflow

      Examples:
        | automation                      | trigger                               |
        | daily-factory-self-triage-report | daily at 10:00                        |
        | feedback-factory-digest         | daily at 08:00                        |
        | github-factory-auto-implement   | GitHub issue labeled                  |
        | github-pr-closed-or-merged      | GitHub pull request closed or merged  |
        | github-factory-mention-assign   | GitHub issue or pull request mentions the factory |
        | github-factory-pr-ci-failure    | GitHub workflow run completed with failure |
        | linear-warp-mention             | Linear issue assigned or created      |
        | slack-dms                       | Slack direct message received         |
        | sentry-fatal-investigate        | Sentry fatal error webhook            |

    @scenario_id=SCN-FACTORY-AUTO-002 @status=planned @evidence=screen @source=17:52
    Scenario: Automations are defined in code and can be switched on and off
      Given the automations are declared in the factory repository
      When a person opens the automation list
      Then each automation shows its trigger, last run and enabled state
      And its configuration is read-only in the UI


@context=factory-visibility @owner=factory-engineering
Feature: Team visibility
  When agent work is centralized, everyone can see in real time what every agent and every
  person is doing, like Google Docs for the team's coding agents.

  Rule: All agent work is visible in real time

    @scenario_id=SCN-FACTORY-VIS-001 @status=planned @evidence=spoken @source=12:36
    Scenario: A person sees all runs across all factories in real time
      Given 12 runs are in progress across two factories
      When a person opens the runs view
      Then the person sees all 12 runs with their title, source, requester, linked PRs and age

    @scenario_id=SCN-FACTORY-VIS-002 @status=planned @evidence=spoken @source=12:56
    Scenario: A person opens a teammate's run
      Given "Ben" started a run "Add diagnostics to cloud agent runs"
      When another engineer opens that run
      Then the engineer sees its transcript, artifacts and origin


@context=factory-metrics @owner=factory-engineering
Feature: Flow and cost metrics
  Factory engineering starts with understanding the flow of work through the factory
  and what it costs.

  Rule: Flow is measured per pull request

    @scenario_id=SCN-FACTORY-METRIC-001 @status=planned @evidence=spoken @source=13:38
    Scenario: The dashboard shows human interactions per pull request
      Given 326 pull requests in the last 7 days
      When a factory engineer opens the productivity dashboard
      Then the dashboard shows the average number of human interactions per pull request and its trend

    @scenario_id=SCN-FACTORY-METRIC-002 @status=planned @evidence=spoken @source=13:47
    Scenario: The dashboard shows median cycle time by segment
      When a factory engineer opens the productivity dashboard
      Then it shows the median time from kickoff to pull request
      And from kickoff to merge
      And from pull request to first human review
      And from first human review to merge

    @scenario_id=SCN-FACTORY-METRIC-003 @status=planned @evidence=screen @source=13:38
    Scenario: The dashboard shows throughput and runs by agent type
      Then the dashboard shows pull requests opened and merged per day
      And total runs and top-level runs split by agent type

  Rule: Cost is measured per pull request and attributable

    @scenario_id=SCN-FACTORY-METRIC-004 @status=planned @evidence=spoken @source=13:52
    Scenario: The dashboard shows cost per pull request with its breakdown
      Given total spend of 5351.38 USD for 326 pull requests
      Then the dashboard shows a cost per pull request of 16.42 USD
      And splits it into compute, platform and inference

    @scenario_id=SCN-FACTORY-METRIC-005 @status=planned @evidence=spoken @source=13:52
    Scenario Outline: Spend is sliced by <dimension>
      When a factory engineer groups spend by "<dimension>"
      Then each group shows its spend and its share of the total

      Examples:
        | dimension |
        | source    |
        | user      |
        | agent     |
        | model     |

    @scenario_id=SCN-FACTORY-METRIC-006 @status=planned @evidence=screen @source=13:52
    Scenario: The most expensive pull requests are listed
      Then the dashboard lists the 20 pull requests with the highest attributed cost

    @scenario_id=SCN-FACTORY-METRIC-007 @status=planned @evidence=spoken @source=14:00
    Scenario: Cost per pull request has a reduction target
      Given a cost per pull request target of 15 USD
      Then the dashboard shows the gap between the current cost per pull request and the target

  Rule: Speed never hides a quality loss

    @scenario_id=SCN-FACTORY-METRIC-008 @status=planned @evidence=spoken @source=25:26
    Scenario: Revert rate is shown next to throughput and cost
      When throughput rises or cost per pull request falls
      Then the dashboard also shows the revert rate for the same period


@context=factory-scoring @owner=factory-engineering
Feature: Scoring (online evaluation)
  Because every run is stored, an LLM judge can evaluate completed runs on dimensions
  the company defines, at a sampled rate, with explicit pass criteria.

  Rule: Scorers evaluate stored runs

    @scenario_id=SCN-FACTORY-SCORE-001 @status=planned @evidence=spoken @source=14:23 @source=14:31
    Scenario: A scorer evaluates completed runs with an LLM judge
      Given the scorer "Redundant tests" judges whether a run added unnecessary tests
      When an implementation run completes and is sampled
      Then the judge records pass or fail with a reason for that run

    @scenario_id=SCN-FACTORY-SCORE-002 @status=planned @evidence=spoken @source=15:05
    Scenario: A scorer samples runs to control its cost
      Given the scorer "Redundant tests" has a sampling rate of 20 percent
      When 100 implementation runs complete
      Then about 20 runs are scored
      And the scorer's own cost is recorded

    @scenario_id=SCN-FACTORY-SCORE-003 @status=planned @evidence=spoken @source=15:16 @source=15:22
    Scenario: A scorer shows its pass rate trend
      When a factory engineer opens a scorer
      Then it shows the pass rate over time, its all-time cost and each scored run with result, reason, run time and cost

    @scenario_id=SCN-FACTORY-SCORE-004 @status=planned @evidence=screen @source=14:37
    Scenario Outline: The company defines its own scoring dimensions
      Given the scorer "<scorer>" exists
      Then its pass rate is shown on the scorer dashboard

      Examples:
        | scorer                |
        | Redundant tests       |
        | Change requested      |
        | Slack MCP reply       |
        | Computer use ask      |
        | Integration MCP loss  |
        | Status update nudge   |


@context=factory-improvement @owner=factory-engineering
Feature: Self-improvement
  Observer agents read the scores, find failures that repeat, and propose changes to the
  factory definition as pull requests with evidence. A human merges them.

  Rule: Repeated failures become proposals to change the factory

    @scenario_id=SCN-FACTORY-IMPROVE-001 @status=planned @evidence=spoken @source=15:28 @source=16:01
    Scenario: An observer agent groups repeated failures
      Given the triage scorer failed 54 times with the same reason
      When the self-improvement loop runs
      Then it records one problem with 54 occurrences and links to the failed runs

    @scenario_id=SCN-FACTORY-IMPROVE-002 @status=planned @evidence=spoken @source=16:07 @source=16:52
    Scenario: The observer proposes a change to the factory definition as a pull request
      Given a recorded problem that the factory definition causes
      When the observer agent proposes a fix
      Then a pull request to the factory repository exists
      And its description states the problem, the solution and the evidence with run links

    @scenario_id=SCN-FACTORY-IMPROVE-003 @status=planned @evidence=screen @source=16:52
    Scenario: A human approves a factory change before it merges
      Given a self-improvement pull request
      Then it cannot merge without at least one approving human review

    @scenario_id=SCN-FACTORY-IMPROVE-004 @status=planned @evidence=screen @source=15:35
    Scenario: Proposals wait in a self-improvement inbox
      When a factory engineer opens the self-improvement inbox
      Then the engineer sees open proposals, their age and their state "needs review" or "approved"

    @scenario_id=SCN-FACTORY-IMPROVE-005 @status=planned @evidence=derived @source=15:47
    Scenario: A merged improvement is checked against the same scorer
      Given a merged factory change that targets the problem "triage investigates inline"
      When the scorer runs on later runs
      Then the occurrence rate of that problem is compared before and after the change


@context=factory-benchmark @owner=factory-engineering
Feature: Benchmarks and model routing
  The company measures models, harnesses and factory configurations on its own real tasks,
  and routes work by the result, instead of trusting public benchmarks or social media.

  Rule: Real tasks become benchmark suites

    @scenario_id=SCN-FACTORY-BENCH-001 @status=planned @evidence=spoken @source=18:34
    Scenario: A factory engineer adds a real task to a benchmark
      Given a completed run of a hard front-end task
      When a factory engineer chooses "Add to benchmark" on the run
      Then the task is added to the benchmark suite "front-end tasks"

    @scenario_id=SCN-FACTORY-BENCH-002 @status=planned @evidence=spoken @source=19:06
    Scenario: A benchmark task is replayed without real side effects
      Given a benchmark task that originally posted to Slack and opened a pull request
      When the task is replayed
      Then it does not post to the real Slack channel
      And it does not open a real pull request

  Rule: Configurations are compared on correctness and cost

    @scenario_id=SCN-FACTORY-BENCH-003 @status=planned @evidence=spoken @source=19:16 @source=19:37
    Scenario: A benchmark runs a matrix of models and harness configurations
      Given the benchmark suite "WarpBench 0.1" with 29 tasks
      When a factory engineer runs it for 4 models and 2 harness configurations
      Then every task runs once for each of the 8 combinations
      And each combination gets a correctness score and an average cost per trial

    @scenario_id=SCN-FACTORY-BENCH-004 @status=planned @evidence=spoken @source=20:07 @source=20:31
    Scenario: The result shows the trade-off between correctness and cost
      Given model "gpt-5.6-sol (high)" reached 94.8 percent correctness at 6.23 USD per trial
      And model "glm 5.3 flash" reached about 93 percent correctness at 1.99 USD per trial
      When a factory engineer opens the result
      Then the chart plots correctness against average cost
      And it names the most efficient option and the lowest-cost option

    @scenario_id=SCN-FACTORY-BENCH-005 @status=planned @evidence=screen @source=20:07
    Scenario: Incomplete scoring is flagged
      Given a model with 28 of 29 tasks scored
      Then the result warns that its plotted score uses incomplete scorer results
      And offers to rescore the missing tasks

  Rule: Benchmark results drive model routing

    @scenario_id=SCN-FACTORY-BENCH-006 @status=planned @evidence=spoken @source=21:11 @source=21:37
    Scenario: A routing rule uses the benchmark result for similar tasks
      Given the team accepts "glm 5.3 flash" for front-end tasks because it costs a third at slightly lower correctness
      When a new front-end task arrives
      Then the routing rule sends it to "glm 5.3 flash"


@context=factory-roles @owner=engineering-leadership
Feature: Product engineering and factory engineering
  Two kinds of engineers use the factory. Product engineers build value for users through the
  factory. Factory engineers make the factory itself better.

  Rule: Product engineering happens through the factory

    @scenario_id=SCN-FACTORY-ROLE-001 @status=planned @evidence=spoken @source=08:07 @source=08:17
    Scenario: A product engineer works through the factory's touchpoints
      Given a product engineer wants a feature
      Then the engineer submits it to the factory
      And works with it at the human touchpoints: spec review, code review and product review

  Rule: Factory engineering tunes the factory

    @scenario_id=SCN-FACTORY-ROLE-002 @status=planned @evidence=spoken @source=08:22 @source=08:33
    Scenario: A factory engineer tunes skills, MCP servers, model mix and workflow
      Given the metrics show high cost per pull request for the implementation agent
      When the factory engineer changes the model mix in the factory definition
      Then the change is measured with the same metrics, scorers and benchmarks


@context=factory-outcomes @owner=engineering-leadership
Feature: Business outcomes
  More AI usage is not more business value. The factory exists to ship more useful software
  at lower cost without a loss of quality.

  Rule: The factory is judged by outcomes, not by usage

    @scenario_id=SCN-FACTORY-OUTCOME-001 @status=planned @evidence=screen @source=02:43
    Scenario: Leadership reviews outcome metrics, not token usage
      When leadership reviews the factory
      Then the review uses throughput, cycle time, cost per pull request and revert rate
      And token volume alone is not a success measure

    @scenario_id=SCN-FACTORY-OUTCOME-002 @status=planned @evidence=spoken @source=25:19
    Scenario: Cost falls while throughput rises and quality holds
      Given cost per pull request was 55 USD six weeks ago
      When the factory engineers have tuned the factory for six weeks
      Then cost per pull request is about 15 USD
      And pull request throughput is about 40 percent higher
      And the revert rate is lower than before
