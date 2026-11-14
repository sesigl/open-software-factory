---
covers: [modules/console/src/**]
---

# console

A read-only web view of a factory. It shows every run of every foreman with its state, origin, requester, pull
request and age; one run's requests, stages, gates, checks, transcripts and trace; the factory definition with
a link to the file in Git, where it changes; and the self-improvement inbox of observer's open proposals. It keeps no
state: each page asks the foreman's, intake's and gatekeeper's APIs, or the forge port's adapter, when it is opened.
Temporal, the trace store and the dashboards keep their own UIs; the console links to them. Decisions:
[ADR 0072](../../docs/decisions/0072-console.md), [ADR 0073](../../docs/decisions/0073-forge-prs-and-console-inbox.md)
(the inbox).

## Quick start

This quick start is scenario `SCN-CONSOLE-001` and is tested on every change. It needs a running foreman
([`modules/foreman`](../foreman/README.md)) with the API token `dev-token`, here on port 8081:

```sh
export CONSOLE_FOREMAN_URL=http://localhost:8081 CONSOLE_FOREMAN_TOKEN=dev-token
npx @opensoftware/console serve
```

Open <http://localhost:8080>. The page lists the foreman's runs, the running ones first, and reloads itself every
10 seconds.

## Commands

| Command | What it does |
| --- | --- |
| `console serve` | Serve the pages below on `PORT`. Exits 2 without `CONSOLE_FOREMAN_URL`. |
| `console doctor [--deep]` | Check the factory as [Health](#health) describes, print one line per check (`ok    <check>` or `FAIL  <check>: <what to do>`) and the count, and exit 1 when a check fails. |

## Pages

| Page | What it shows |
| --- | --- |
| `/` | The runs of every foreman: title, factory, state, source, requester, pull request and age. Runs that have not ended come first, the one that started last first, then the ended runs, the one that ended last first. A foreman that does not answer is named above the list. The page shows the first page of each foreman's runs and links "Next page" (`?page=`) while one has more ([ADR 0115](../../docs/decisions/0115-lists-in-pages.md)). |
| `/?state=<state>` | Only the runs in the state `running`, `blocked`, `complete`, `failed` or `cancelled`, as the foremen filter them. Another state answers 400. |
| `/runs/<runId>` | One run: its state, factory and factory version, age, pull request, trace and Temporal history; its origin, or with `CONSOLE_INTAKE_URL` every request of its work item; and its stages as its evidence, each with its agent ("waits" for a stage that only waits, ADR 0107), state, transcript, gate, checks and the reason it failed. A run that a person ran again names its attempt and links the run before it. 404 when no foreman knows the run. |
| `/work` | With `CONSOLE_INTAKE_URL`: intake's latest work items, the one received last first, each with its origin, type, status, source, requester, run and age, also work that waits without a run, one page of intake's inbox at a time with a link "Next page" (`?cursor=`) while more follow. 404 without `CONSOLE_INTAKE_URL`. |
| `/factory` | The factory definition in `CONSOLE_FACTORY`: its name, description, providers and agents with their harness and model. |
| `/factory/agents/<name>` | One agent's configuration, and the link to the file on the branch where it changes. 404 for an agent the factory does not declare. |
| `/health` | The checks of `console doctor` as a table: each check, its state and what to do. 200 when every check is ok, else 503. |
| `/inbox` | The self-improvement inbox: the open pull requests of `CONSOLE_INBOX_REPOSITORY` whose branch starts with `CONSOLE_INBOX_PREFIX` (default `observer/`), newest first, each with its link, branch, author, state ("approved", "changes requested" or "needs review") and age. A forge adapter that fails is named above the list. 404 without `CONSOLE_INBOX_REPOSITORY`. |

Every page links the runs, the work items (with `CONSOLE_INTAKE_URL`), the factory, the health page and the dashboards in `CONSOLE_LINKS`. The runs pages reload themselves every
`CONSOLE_REFRESH` seconds. Without `CONSOLE_USER_HEADER` the console is read-only: it has no forms, and any method but
`GET` and `HEAD` answers 405. It shows what the foreman and intake show, so run it behind your sign-in proxy, such as
oauth2-proxy.

Actions ([ADR 0089](../../docs/decisions/0089-console-actions.md)): set `CONSOLE_USER_HEADER` to the header in which
your sign-in proxy sends the signed-in person, like `X-Forwarded-Email`. Then `/work` has the form "submit work"
(title, type and description), which the console posts to intake with that person as the requester and the origin
`console`; intake checks the fields. A form without the header answers 401, a form from another site 403, and a
form that intake refuses 502 with intake's answer. Without `CONSOLE_INTAKE_URL` the console takes no form "submit work".
The page of a `failed` or `cancelled` run has the form "run again" ([ADR 0105](../../docs/decisions/0105-run-a-work-item-again.md)),
which the console posts to the foreman's `POST /v1/runs/<runId>/retry` with that person as `by`; it then leads to the
new run's page. A retry that the foreman refuses answers with the foreman's status and its problem's detail.
The page of a `running` or `blocked` run has the forms "Steer" (with a message), "Take over" (while a stage runs),
"Hand back" (while a person holds a stage) and "Cancel", which the console posts to the foreman's
`POST /v1/runs/<runId>/signals` with that person as `by`; the run lists them under "Actions"
([ADR 0118](../../docs/decisions/0118-actions-record-the-person.md)). With `CONSOLE_GATEKEEPER_URL` a pending gate of a
stage has the forms "Approve" and "Reject" (with a reason), which the console posts to gatekeeper's
`POST /v1/gates/<gateId>/decisions` with that person as `by`: gatekeeper refuses a person who is in no group the gate
waits for, so list the identity the proxy sends, like `ada@acme.dev`, in gatekeeper's groups. Each form leads back to
the run's page, or answers with the API's status and its problem's detail. Only set the variable behind a
proxy that sets the header and removes it from the browser's requests.

Several factories: list each foreman in `CONSOLE_FOREMAN_URL`, comma-separated, and their tokens in the same order in
`CONSOLE_FOREMAN_TOKEN`, or one token for all.

The inbox: observer opens each proposal as a pull request from a branch `observer/<problem>-<hash>`
([observer](../observer/README.md)). The console runs the forge port's adapter in `CONSOLE_FORGE_ADAPTER` with
`prs <repo> --head <prefix>` ([forge port](../../ports/forge/README.md)), with `CONSOLE_FORGE_URL` and
`CONSOLE_FORGE_TOKEN` as its `FORGE_URL` and `FORGE_TOKEN`. A token that may read pull requests is enough. For a
Forgejo, such as Codeberg, set `CONSOLE_FORGE_ADAPTER=npx -y @opensoftware/forge-forgejo` and its URL.

Links: `CONSOLE_TRACE_URL` and `CONSOLE_SESSION_URL` are URL templates of the trace store, such as Langfuse or
Phoenix, with `{runId}` or `{traceId}`, and `{sessionId}`. `{traceId}` is the run's `traceId`, which a foreman with
traces names ([ADR 0087](../../docs/decisions/0087-run-traces.md)); Phoenix finds a trace by it. The foreman sets the run's ID as `osf.run.id` on every run's traces
([runlog](../runlog/README.md)), and a stage's harness session is its transcript. `CONSOLE_SPAN_URL`, with `{traceId}`
and `{spanId}`, makes each started stage's name a link to its span in the run's trace, such as Jaeger's
`/trace/{traceId}?uiFind={spanId}` ([ADR 0121](../../docs/decisions/0121-stage-run-record-in-the-trace.md)). `CONSOLE_TEMPORAL_URL` links the
run's history: `<url>/namespaces/<CONSOLE_TEMPORAL_NAMESPACE>/workflows/<runId>`.

## Health

`console doctor` and `/health` check, in this order ([ADR 0086](../../docs/decisions/0086-health-routes.md)):

1. Each foreman, intake and gatekeeper the console names: its `GET /v1/health`, one line per check the server reports
   (such as `foreman temporal` or `intake nats`), and whether it accepts the console's token. A server that does not
   answer names the variable of its URL; a refused token names the console's variable and the server's own.
2. `factory`: the definition in `CONSOLE_FACTORY` can be read.
3. `groups`, with `CONSOLE_GROUPS`: each group of the gatekeeper's groups file has a member who is not the example's
   `slack:U0EXAMPLE`, the member the reference `groups.json` ships in place of a person
   ([ADR 0114](../../docs/decisions/0114-the-example-member-of-the-reference-groups.md)). The check reads every group,
   not only the policy's approvers, and cannot tell whether a Slack ID belongs to a real person.
4. Only with `console doctor --deep` ([ADR 0120](../../docs/decisions/0120-deep-checks-of-console-doctor.md)):
   `model <route>`, one chat completion of one token per model route of the factory definition's agents through the
   gateway in `CONSOLE_MODEL_URL`, and `harness`, the command in `CONSOLE_HARNESS_COMMAND` answers ACP `initialize`
   within 10 seconds. A model call costs money, so `/health` and `console doctor` without `--deep` never make one.

The links to the Temporal UI and the trace store are for the browser, so the console does not check them; the
foreman's `temporal` check covers Temporal.

A server of a release before `/v1/health` fails its check with the advice to update it. When every check is ok,
`console doctor` prints the count last, like `all 7 checks ok`.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `PORT` | string | `"8080"` | serve: the port the web pages are served on. |
| `OSF_NOW` | string |  | The current time, like 2026-01-01T00:00:00Z, for the age of a run. Default: the clock. |
| `CONSOLE_FOREMAN_URL` | string |  | serve: the base URL of a foreman's API, or several, comma-separated, one per factory. Required. |
| `CONSOLE_FOREMAN_TOKEN` | string |  | serve: the foreman's FOREMAN_API_TOKEN, sent as Authorization: Bearer <token>; several, comma-separated, in the order of CONSOLE_FOREMAN_URL, or one for all. |
| `CONSOLE_INTAKE_URL` | string |  | serve: the base URL of intake's API. Set, a run's page lists every request of its work item. |
| `CONSOLE_INTAKE_TOKEN` | string |  | serve: intake's INTAKE_API_TOKEN. |
| `CONSOLE_GATEKEEPER_URL` | string |  | serve: the base URL of gatekeeper's API. Set, a run's page shows each gate's state and who it waits for. |
| `CONSOLE_GATEKEEPER_TOKEN` | string |  | serve: gatekeeper's GATEKEEPER_API_TOKEN. |
| `CONSOLE_TRACE_URL` | string |  | serve: the link to a run's trace in the trace store, with {runId} or {traceId}, like https://langfuse.acme.dev/traces?run={runId} or Phoenix's http://127.0.0.1:6006/projects/UHJvamVjdDox/traces/{traceId}. A run without a traceId gets no link from a template with {traceId}. |
| `CONSOLE_SESSION_URL` | string |  | serve: the link to a stage's transcript, with {sessionId}, like https://langfuse.acme.dev/sessions/{sessionId}. |
| `CONSOLE_SPAN_URL` | string |  | serve: the link to a stage's span in the run's trace, with {traceId} and {spanId}, like http://127.0.0.1:16686/trace/{traceId}?uiFind={spanId} for Jaeger. |
| `CONSOLE_TEMPORAL_URL` | string |  | serve: the base URL of the Temporal UI. Set, a run's page links its history. |
| `CONSOLE_TEMPORAL_NAMESPACE` | string | `"default"` | serve: the Temporal namespace of the runs, the foreman's FOREMAN_TEMPORAL_NAMESPACE. |
| `CONSOLE_LINKS` | string |  | serve: the dashboards every page links, as name=url, comma-separated, like Grafana=https://grafana.acme.dev. |
| `CONSOLE_REFRESH` | string | `"10"` | serve: the seconds after which the browser reloads the runs pages. |
| `CONSOLE_FACTORY` | string | `"factory.yaml"` | serve: the factory definition that /factory shows, read-only. |
| `CONSOLE_GROUPS` | string |  | doctor and /health: the groups file of the factory's gatekeeper, like /factory/groups.json. Set, a group without a member but the example's slack:U0EXAMPLE fails the check groups. |
| `CONSOLE_FACTORY_PATH` | string | `"factory.yaml"` | serve: the path of the factory definition in its Git repository. |
| `CONSOLE_REPOSITORY_URL` | string |  | serve: the web URL of the factory's Git repository, like https://github.com/acme/factory. Set, the configuration pages link the file. |
| `CONSOLE_BRANCH` | string | `"main"` | serve: the branch where the factory definition changes. |
| `CONSOLE_INBOX_REPOSITORY` | string |  | serve: the repository of observer's pull requests, as <owner>/<name>, like acme/factory. Set, /inbox lists its open proposals. |
| `CONSOLE_INBOX_PREFIX` | string | `"observer/"` | serve: the start of the branch names that /inbox lists. |
| `CONSOLE_FORGE_ADAPTER` | string | `"npx -y @opensoftware/forge-github"` | serve: the command line of the forge port's adapter that /inbox runs with prs (ADR 0073). |
| `CONSOLE_FORGE_URL` | string |  | serve: the forge's API, the adapter's FORGE_URL, like https://codeberg.org for forge-forgejo. Default: the adapter's own. |
| `CONSOLE_FORGE_TOKEN` | string |  | serve: the adapter's FORGE_TOKEN; a token that may read pull requests is enough. |
| `CONSOLE_USER_HEADER` | string |  | serve: the header in which the sign-in proxy sends the signed-in person, like X-Forwarded-Email. Set, the console takes actions in that person's name, such as submitting work on /work (ADR 0089); unset, it is read-only. Only set it behind a proxy that sets the header and removes it from the browser's requests. |
| `CONSOLE_MODEL_URL` | string |  | doctor --deep: the OpenAI-compatible base URL of the model gateway (LiteLLM), ending in /v1; it gets one chat completion of one token per model route of the factory definition. |
| `CONSOLE_MODEL_TOKEN` | string |  | doctor --deep: the gateway's key, sent as Authorization: Bearer <token>. |
| `CONSOLE_HARNESS_COMMAND` | string |  | doctor --deep: the command line, run with sh -c, that starts the harness's ACP agent, like claude-code-acp; it must answer ACP initialize within 10 seconds. |

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/console/`. Merging it
creates the tag `console-v<version>`. The workflow `.github/workflows/publish-console.yml` then builds the package
and publishes it to npm as `@opensoftware/console`. When the newest tag is missing on npm, the next run of the
workflow on `main` publishes it. To publish a tag again, run the workflow by hand with the tag. The first release is
`0.1.0`; until `1.0.0`, a breaking change raises the minor version.

The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)): the
GitHub environment `npm`, a token only for the first version, then a trusted publisher for the workflow
`publish-console.yml`. No credential is stored in the repository.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-CONSOLE-001 | implemented | A new user opens the runs page of the quick start |
| SCN-CONSOLE-002 | implemented | The help lists every command |
| SCN-CONSOLE-003 | implemented | An unknown command shows the usage |
| SCN-CONSOLE-004 | implemented | Serve without a foreman exits 2 and names the variable |
| SCN-CONSOLE-005 | implemented | A run's row shows its title, source, requester, pull request and age |
| SCN-CONSOLE-006 | implemented | The runs page lists the runs of two factories |
| SCN-CONSOLE-007 | implemented | Runs that have not ended come first, the newest first |
| SCN-CONSOLE-008 | implemented | A person filters the runs by the state "failed" |
| SCN-CONSOLE-009 | implemented | The runs page links a filter for each of the five states |
| SCN-CONSOLE-010 | implemented | An unknown state answers 400 and names the five states |
| SCN-CONSOLE-011 | implemented | A foreman that does not answer is named, and the other foreman's runs are listed |
| SCN-CONSOLE-012 | implemented | The runs page reloads itself every 10 seconds |
| SCN-CONSOLE-013 | implemented | The console calls each foreman with its token |
| SCN-CONSOLE-014 | implemented | A title with HTML is shown as text |
| SCN-CONSOLE-015 | implemented | The run page shows the stages with their agent and state |
| SCN-CONSOLE-016 | implemented | The run page links its Slack origin and its pull request |
| SCN-CONSOLE-017 | implemented | With intake, the run page lists every request of the work item |
| SCN-CONSOLE-018 | implemented | The run page links its trace and each stage's transcript |
| SCN-CONSOLE-019 | implemented | The run page links its history in the Temporal UI |
| SCN-CONSOLE-020 | implemented | The run page shows a stage's gate with its state and who it waits for |
| SCN-CONSOLE-021 | implemented | The run page shows the checks a stage waits for and why a stage failed |
| SCN-CONSOLE-022 | implemented | A run that no foreman knows answers 404 |
| SCN-CONSOLE-023 | deprecated | The factory page lists the agents with their harness and model |
| SCN-CONSOLE-024 | implemented | An agent's page is read-only and links to the file and the branch in Git |
| SCN-CONSOLE-025 | implemented | An agent that the factory does not declare answers 404 |
| SCN-CONSOLE-026 | implemented | A POST to the console answers 405 |
| SCN-CONSOLE-027 | implemented | Every page links the dashboards in "CONSOLE_LINKS" |
| SCN-CONSOLE-028 | implemented | A foreman that cannot be reached is named on the runs page |
| SCN-CONSOLE-029 | implemented | An origin link that is not http or https is shown as text |
| SCN-CONSOLE-030 | implemented | The inbox lists observer's open pull requests, the newest first |
| SCN-CONSOLE-031 | implemented | A proposal shows its age and the state "needs review" or "approved" |
| SCN-CONSOLE-032 | implemented | A proposal a reviewer asked to change shows "changes requested" |
| SCN-CONSOLE-033 | implemented | The inbox lists the branches of the prefix in "CONSOLE_INBOX_PREFIX" |
| SCN-CONSOLE-034 | implemented | A forge that refuses the token is named on the inbox |
| SCN-CONSOLE-035 | implemented | Without a repository the inbox answers 404 and names the variable |
| SCN-CONSOLE-036 | implemented | The factory page lists the agents with their harness, model and effort |
| SCN-CONSOLE-037 | implemented | A healthy factory passes every check of "console doctor" |
| SCN-CONSOLE-038 | implemented | "console doctor" names each failing check and what to do |
| SCN-CONSOLE-039 | implemented | A foreman that does not answer is named with the variable of its URL |
| SCN-CONSOLE-040 | implemented | The page "/health" shows the checks and answers 503 when one fails |
| SCN-CONSOLE-041 | implemented | The run page links the run's trace by its trace ID |
| SCN-CONSOLE-042 | implemented | A trace link with "{traceId}" is left out for a run without a trace ID |
| SCN-CONSOLE-043 | implemented | The work page lists each work item with its status and its run |
| SCN-CONSOLE-044 | implemented | Without intake the work page answers 404 and names the variable |
| SCN-CONSOLE-045 | implemented | A signed-in person submits work from the work page |
| SCN-CONSOLE-046 | implemented | A form without the signed-in person submits nothing |
| SCN-CONSOLE-047 | implemented | Without "CONSOLE_USER_HEADER" the console stays read-only |
| SCN-CONSOLE-048 | implemented | "console doctor" names a missing foreman URL, a server without "/v1/health" and a factory it cannot read |
| SCN-CONSOLE-049 | implemented | A form from another site submits nothing |
| SCN-CONSOLE-050 | implemented | The run page of a failed or cancelled run has the form "run again" for a signed-in person |
| SCN-CONSOLE-051 | implemented | A person runs a failed run again from the run page |
| SCN-CONSOLE-052 | implemented | The run page of a run that is running or complete has no form "run again" |
| SCN-CONSOLE-053 | implemented | A retry the foreman refuses shows the foreman's problem |
| SCN-CONSOLE-054 | implemented | The run page of a run that ran again links the run before it |
| SCN-CONSOLE-055 | implemented | The run page shows a stage that only waits with "waits" instead of an agent |
| SCN-CONSOLE-056 | implemented | "console doctor" fails on a group whose only member is the example's |
| SCN-CONSOLE-057 | implemented | The runs page links the next page while a foreman has more runs |
| SCN-CONSOLE-058 | implemented | The work page links the next page of intake's inbox |
| SCN-CONSOLE-059 | implemented | "console doctor" fails on a groups file it cannot read |
| SCN-CONSOLE-060 | implemented | A person steers a running run from the run page |
| SCN-CONSOLE-061 | implemented | A person takes over, hands back and cancels a run from the run page |
| SCN-CONSOLE-062 | implemented | A person approves and rejects a run's pending gate from the run page |
| SCN-CONSOLE-063 | implemented | A decision gatekeeper refuses shows gatekeeper's problem |
| SCN-CONSOLE-064 | implemented | "console doctor --deep" calls each model route once and asks the harness to initialize |
| SCN-CONSOLE-065 | implemented | "console doctor --deep" names a failing model route and a harness that answers "initialize" with an error |
| SCN-CONSOLE-066 | implemented | "console doctor" without "--deep" calls no model |
| SCN-CONSOLE-067 | implemented | "console doctor --deep" names the variables of the gateway and the harness when they are not set |
| SCN-CONSOLE-068 | implemented | "console doctor --deep" names a gateway that does not answer and a harness that ends without a word |
| SCN-CONSOLE-069 | implemented | The page "/health" calls no model |
| SCN-CONSOLE-070 | implemented | The run page links each stage to its span in the run's trace |
| SCN-CONSOLE-080 | implemented | The run page lists the actions of a run with the person who sent each |
| SCN-CONSOLE-110 | implemented | The run page links no span of a run whose foreman names no trace |
