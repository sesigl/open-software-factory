---
covers: [packages/testkit/bin/**, packages/testkit/src/**]
---

# testkit

The only way system tests touch a module. A system test declares its scenario with `scenario(id, fn)` and uses
the `sut` handle and the fakes; `testkit run` runs the tests and writes a JUnit report that carries each
scenario ID, so the PASS check can join results with scenarios.

It is built in T-02 (see [`TODO.md`](../../TODO.md)) and released to npm as `@opensoftware/testkit` (see
[Releases](#releases)). Install it with `vitest` as a dev dependency of a module or an adapter.

## Quick start

This quick start is scenario `SCN-TK-001` and is tested on every change. In a module folder with `features/`
and `system-tests/`:

```sh
node ../../packages/testkit/bin/testkit.ts run --junit report.xml
```

Each test case in `report.xml` is named after its scenario and has the property `scenario` with the ID.

## Commands

| Command | What it does |
| --- | --- |
| `testkit run --junit <file>` | Run `system-tests/**/*.test.ts` of the module in the current folder with globals, no retries and a 120 s test timeout. Write the JUnit report to `<file>`. Exit 1 when a test fails. |
| `testkit conformance <port features folder> --junit <file>` | Run an adapter's system tests like `run`, then print `CONFORMANCE <id> passed` (or `failed`, `was skipped`, `has no system test`) for every implemented `@conformance` scenario in the folder and `N of M conformance scenarios passed`. Exit 1 unless all passed. |

## Writing a system test

See [`skills/write-system-test`](../../skills/write-system-test/SKILL.md). The context of `scenario` holds:

- `given`, `when`, `then`: step functions; each label repeats the scenario's step text.
- `sut.cli(args, { env })`: runs the module's `bin` in its own process, with `$INPUT` as the current directory.
  The module gets `INPUT` and `OUTPUT` (the two folders), `OSF_DATA` (its private data folder, which persists
  for the scenario and which the test has no path into), `OSF_NOW=2026-01-01T00:00:00Z` and `OSF_SEED=1`.
  `env` may only name variables the module's README documents under Configuration. `bin` must be the built
  artifact: a `bin` in `src/` fails the test (BOUNDARY-RUNTIME).
- `sut.files`: `put`, `read`, `list`, `remove` and `clear` in the module's input and output folders. Every path
  starts with `$INPUT/` or `$OUTPUT/` and stays inside that folder; any other path fails the test. `path` gives
  the absolute path of a file there, for a library in `packages/` whose functions take paths (ADR 0039).
- `sut.readme`: `quickStartArgs()` (the arguments of the README's `npx <package> ...` line) and
  `quickStartOutput()` (the first `$OUTPUT/<file>` it names).
- `sut.git`: `$INPUT` is a Git repository with a fixed author and clock.
- `sut.http.start(args, { env })`: starts the module's `bin` as a server with the same environment as `sut.cli`
  plus `PORT`, waits until it listens on `127.0.0.1:PORT` and returns the base URL. Then `get`, `post` and
  `request` call it (the body is parsed for `application/json` and any `+json` type, such as
  `application/problem+json`), `stop()` stops it so the test can start it again, for example with another
  environment, and `client<paths>()` gives an [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) client
  typed by the module's generated OpenAPI `paths`. A server that exits first fails the test with its error output.
- `sut.mcp.connect(args, { env })`: starts the module's `bin` as an MCP server on stdio and returns a connected
  MCP client (`listTools`, `callTool`, ...).
- `sut.action(inputs, { event, eventName, repository, sha, env })`: runs the module's composite `action.yml` like a
  GitHub runner ([ADR 0029](../../docs/decisions/0029-proof-capture-and-action.md)). Each `run` step runs in bash with
  `$INPUT` as `GITHUB_WORKSPACE`, the environment of `sut.cli`, `GITHUB_EVENT_PATH` with `event` (default `{}`),
  `GITHUB_EVENT_NAME` (`pull_request` when the event has one, else `push`), `GITHUB_REPOSITORY` (default
  `acme/web`), `GITHUB_SHA` (default the HEAD of `$INPUT`), `GITHUB_SERVER_URL=https://github.com`,
  `GITHUB_RUN_ID=1`, `GITHUB_OUTPUT`, `GITHUB_STEP_SUMMARY` and `RUNNER_TEMP`. The input `command` is the module's
  built `bin`, so the action runs the module under the guards. Steps with `uses` are skipped and listed in `skipped`;
  `outputs` holds the `name=value` lines the steps wrote to `GITHUB_OUTPUT`, and `summary` the text they wrote to
  the job summary ([ADR 0031](../../docs/decisions/0031-spec-trace-action-and-dogfood.md)). Only `${{ inputs.<name> }}`, `${{ github.action_path }}` and
  `${{ github.token }}` (`testkit-github-token`) are expanded; any other expression, an `if:` on a `run` step or a
  shell other than bash fails the test. The first failing step ends the run with its exit code.
- `sut.acp.connect(args, { env, approve })`: starts the module's `bin` as an ACP agent on stdio, such as a harness
  adapter ([ADR 0050](../../docs/decisions/0050-harness-port.md)), and returns a connected client. `agent` is the name
  and version the module gave; `newSession(folder)` starts a session in a folder below `$INPUT` or `$OUTPUT` (default
  `$INPUT`, created when missing) and returns its `id`, `prompt(text)`, which waits for the end of the turn and gives
  its `stopReason` and the `reply` streamed meanwhile, and `cancel()`. A second `prompt` before the first ends steers
  the running turn. The client approves every tool call the module asks about, or refuses each one with
  `approve: false`, and lists them in `permissionRequests()`. `exited()` waits for the module to exit and gives its exit code. It
  offers the module no file system and no terminal.
- `sut.acp.serve(start, { approve })`: the same client for a library that serves ACP in the test's own process, such
  as `@opensoftware/harness-proxy` ([ADR 0052](../../docs/decisions/0052-harness-claude-code.md)). `start` gets the
  streams `{ input, output }` to serve on; `exited()` gives 0 when its promise resolved and 1 when it rejected.
- `sut.events.watch(nats, subjects)`: records the CloudEvents published on a NATS server from now on.
  `received(type, { count, timeoutMs })` waits for them and, on timeout, names what arrived instead;
  `publish(subject, event)` sends an event to the module.

Every server, client and subscription stops when the scenario ends, before the fakes.
- `fakes.fixture(name)`, `fakes.fromRepository(dir)`: fixture files.
- `fakes.modelGateway([{ when, reply }])`: an OpenAI-compatible endpoint on `127.0.0.1`. Pass its `url` (ending
  in `/v1`) to the module through its documented config. `POST /v1/chat/completions` whose body contains `when`
  gets `reply`, with the token `usage` of the entry when it has one (`{ prompt_tokens, completion_tokens }`, default 0
  and 0); any other call gets HTTP 500 and fails the scenario with the request shown. The same gateway answers the
  Anthropic Messages API at `anthropicUrl` (no `/v1`, as `ANTHROPIC_BASE_URL` takes it), as JSON or as a stream
  when the call asks for one ([ADR 0052](../../docs/decisions/0052-harness-claude-code.md)). A call to
  `POST /v1/messages` takes the first matching entry that has not answered yet, so a tool loop scripts one entry per
  model call; after that the last matching entry answers again. An entry may have `tools` (`{ name, input }`, sent
  as `tool_use` blocks with the ids `toolu_1`, `toolu_2`, ...), a `stopReason` (default `tool_use` with tools,
  `end_turn` without) and `hangs: true`, which never answers the call. An unscripted Messages call gets HTTP 400.
  The gateway also answers the OpenAI Responses API at `POST /v1/responses` as a stream, and a chat completions call
  that asks for a stream with a streamed answer ([ADR 0053](../../docs/decisions/0053-harness-codex-opencode.md)).
  Both take entries in order as the Messages API does, with `tools`, `usage` and `hangs`; an unscripted call gets
  HTTP 400. On the Responses API a tool with an object `input` is a `function_call` and one with a text `input` a
  `custom_tool_call`, such as Codex's `apply_patch`; the call IDs are `call_1`, `call_2`, ... A streamed chat answer
  sends each tool as a `tool_calls` delta and ends with `stopReason` as its `finish_reason` (default `tool_calls`
  with tools, `stop` without), for example `content_filter`. A chat completions call without a stream keeps the
  first matching entry. `calls` lists every call with its `path` and `body`.
- `fakes.http([{ method, path, status, body, contentType, times }])`: a scripted JSON API on `127.0.0.1`
  ([ADR 0021](../../docs/decisions/0021-testkit-scripted-http.md)). Pass its `url` to the module through its
  documented config. A request whose method (default `GET`) and exact path with query match a route gets its
  `status` (default 200) and JSON `body`; a route with `times` answers only that many requests, and later ones go to
  the next matching route, for example an outage before a success ([ADR 0023](../../docs/decisions/0023-runlog.md)).
  A route with `contentType`, such as `text/html`, answers its `body` text as is, for example a page to capture.
  Any other request gets HTTP 404 and fails the scenario with the request shown. `requests()` lists what it
  received as `METHOD /path`; `received()` lists each request with its `body` (JSON, or text when it is not JSON;
  a gzip body is unpacked first); `headers()` lists each request with its headers, names in lower case
  ([ADR 0032](../../docs/decisions/0032-scorekit.md)).
- `fakes.harness([{ when, edits, reply }])`: a scripted coding agent that speaks ACP on stdio
  ([ADR 0018](../../docs/decisions/0018-testkit-scripted-acp-harness.md)). Start it with its `command` and `args`.
  The first prompt that contains `when` gets the `edits` (files by path below the session's folder) and the
  `reply`, then the turn ends with `end_turn`. Any other prompt ends with `refusal` and fails the scenario with the
  prompt shown. `prompts()` lists what it received. A turn may also have `tools`: tool calls (`title` and ACP
  `kind`) the agent asks the client to approve before the edits, which it writes only when the client allowed every
  one; `toolCalls()` lists each with its `outcome`, `allowed` or `refused`. A turn with `waitsFor` keeps running
  until the session gets a prompt that contains that text, a steering message, which ends at once with `end_turn`;
  a cancel of the session ends the waiting turn with `cancelled` instead, unless the turn has `ignoresCancel`.
  `stopReason` ends the turn with another stop reason, such as `max_tokens` ([ADR 0050](../../docs/decisions/0050-harness-port.md)).
  A turn with `usage` (`{ inputTokens, outputTokens }`) reports it in its `session/prompt` answer, and `costUsd`
  sends a `usage_update` with that cost in USD first ([ADR 0052](../../docs/decisions/0052-harness-claude-code.md)).
  The agent also takes a steering message as the request `_session/steering` (`{ sessionId, prompt }`), as
  codex-acp does: it wakes the waiting turn whose text it contains and answers `{ outcome: "injected" }`, or
  `{ outcome: "failed" }` when no turn waits for it. `steeringRequests()` lists the texts of those requests
  ([ADR 0053](../../docs/decisions/0053-harness-codex-opencode.md)).
- `fakes.postgres()`: PostgreSQL 18 for this scenario, as PGlite in the test's process behind a small
  wire-protocol server, with no Docker ([ADR 0049](../../docs/decisions/0049-in-memory-stand-ins.md)). The module
  connects to `postgres://test:test@127.0.0.1:<port>/test` with its own driver; a wrong password is refused with
  SQLSTATE 28P01. Connections run one at a time: a transaction holds the database until it ends, so code must not
  wait inside a transaction for a second connection of its own.
- `fakes.nats()`, `fakes.temporal()`, `fakes.s3()`: a real service in a container for this
  scenario ([ADR 0016](../../docs/decisions/0016-testkit-service-fakes.md)). Each gives only what a module needs
  to reach it: a URL, an address or an endpoint with keys. Docker must run.
- `fakes.forge()`: a real Forgejo with a user and an API token (`url`, `token`, `owner`). The test can
  `createRepository`, `openPullRequest` and `mergePullRequest`, read a pull request's `comments` and `statuses`,
  list the repository's `pullRequests` (title, body, head and base branch, state, URL) a module opened, and read a
  `file` on a branch ([ADR 0046](../../docs/decisions/0046-observer.md)).
- `fakes.collector(config)`: the real OpenTelemetry Collector Contrib in a container, running the config text a
  module wrote ([ADR 0025](../../docs/decisions/0025-runlog-collector-config-pack.md)). The config receives OTLP/HTTP
  on `0.0.0.0:4318` and exports to `${env:OTEL_EXPORTER_OTLP_ENDPOINT}`, which the fake points at its own receiver.
  `send(request)` posts an OTLP/JSON request to the Collector; `exported({ count, timeoutMs })` waits for the
  requests the Collector exported (JSON encoding) and, on timeout, shows the Collector's log. Docker must run.
- `fakes.slack()`: a fake Slack Web API (`auth.test`, `chat.postMessage`, `conversations.history`,
  `conversations.replies`, `reactions.add`) at `url` with `token`. `auth.test` answers the bot's user ID `bot`, which
  every message the module posts carries. The test reads `messages(channel)`, with the `buttons` of each message's
  `actions` blocks, and posts as a person with `say`. Any other method fails the scenario. `deliverTo(events,
  interactivity)` names the module's request URLs: `say` then also sends a `message` event, and `press({ channel,
  ts, actionId, user })` sends a `block_actions` payload for a button of a message. Both are signed like Slack with
  the fake's `signingSecret` and the fixed clock, so the module checks them as it would check Slack; `sign(body)`
  gives the same headers for a request the test sends itself
  ([ADR 0048](../../docs/decisions/0048-gatekeeper-server.md)).

A `planned` scenario's test must fail; when it passes, the testkit fails it and asks for `@status=implemented`.

## README rules for checks

`@opensoftware/testkit/readme` gives programs the README rules the testkit applies when a test starts a module:
`documentedEnv(readme)` is the set of variables named in backticks in the Configuration section, and
`readmeSection(readme, heading)` the text of one `## ` section. The BOUNDARY-ENV check uses them
([ADR 0042](../../docs/decisions/0042-spec-files-library.md)).

## Runtime guards

- BOUNDARY-RUNTIME: every surface starts the module's built `bin` in its own process, with `$INPUT` as its
  folder and `OSF_DATA` for its own state. The test reaches the module only through `sut`.
- NOREAL: every Node process of the module (and the processes it starts) loads a network guard through
  `NODE_OPTIONS`. A TCP connection may go to a loopback address or to a host of the testkit's containers; local
  sockets are allowed. Any other connection fails as unreachable and fails the scenario with
  `NOREAL: the module tried to reach <host>:<port>`. A module written in another language gets no guard.
- REACH: every Node process of the module also records which of the module's code it ran, in
  `reports/coverage/` of the workspace ([ADR 0019](../../docs/decisions/0019-reach-from-process-coverage.md)).
  `osf check REACH` fails on lines a pull request adds that no system test reaches.
- The clock and the seed are fixed through `OSF_NOW` and `OSF_SEED`; a module reads them instead of the system
  clock and a random seed.

## Configuration

The testkit reads two environment variables and passes them on to the module:

| Variable | Meaning |
| --- | --- |
| `PLAYWRIGHT_BROWSERS_PATH` | Where Playwright keeps its browsers. The module gets it like `PATH`, since its `HOME` is the working folder. |
| `__STRYKER_ACTIVE_MUTANT__` | The mutant Stryker activates during a mutation run (`osf mutation`, ADR 0037). The module's instrumented build reads it in its own process. |

`testkit conformance` passes the port features folder to the
tests itself.

An adapter's tests (`adapters/<port>/<adapter>/system-tests/`) use the scenario IDs of its port; the testkit
reads their status from `ports/<port>/features/` or from the folder `testkit conformance` names.

## Releases

release-please opens a release pull request from the Conventional Commits under `packages/testkit/`. Merging it
creates the tag `testkit-v<version>`. The workflow `.github/workflows/publish-testkit.yml` then builds `dist/`
with `pnpm build` and publishes the package to npm. In this repository the package runs from its TypeScript
sources; `publishConfig` points the published `exports` and `bin` at `dist/`. When the newest tag is missing on
npm, the next run of the workflow on `main` publishes it. To publish a tag again, run the workflow by hand with the
tag. The first release is `0.1.0`; until `1.0.0`, a breaking change raises the minor
version.

The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)):
the npm scope `@opensoftware`, the GitHub environment `npm`, a token only for the first version, then a trusted
publisher for the workflow `publish-testkit.yml`. No credential is stored in the repository.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-TK-001 | implemented | The JUnit result of a scenario's system test carries the scenario ID |
| SCN-TK-002 | implemented | sut.files refuses a path outside $INPUT and $OUTPUT |
| SCN-TK-003 | implemented | sut.readme gives the quick start command and the file it promises |
| SCN-TK-004 | implemented | sut.files.clear empties a folder |
| SCN-TK-005 | implemented | The module runs with a fixed clock and seed |
| SCN-TK-006 | implemented | A scripted model call gets its scripted reply |
| SCN-TK-007 | implemented | An unscripted model call fails the test with the request shown |
| SCN-TK-008 | implemented | fakes.postgres gives the module a reachable PostgreSQL |
| SCN-TK-009 | implemented | fakes.nats gives the module a reachable NATS server |
| SCN-TK-010 | implemented | fakes.temporal gives the module a Temporal server with the namespace "default" |
| SCN-TK-011 | implemented | fakes.s3 gives the module an S3 API that stores objects |
| SCN-TK-012 | implemented | fakes.forge shows the comment and the commit status a module posts on a pull request |
| SCN-TK-013 | implemented | fakes.slack shows the message a module posts |
| SCN-TK-014 | implemented | sut.http starts the module as a server and calls its API |
| SCN-TK-015 | implemented | sut.http shows the server's error output when it exits before it listens |
| SCN-TK-016 | implemented | sut.mcp connects to the module's MCP server and calls a tool |
| SCN-TK-017 | implemented | sut.events records the CloudEvent a module publishes on NATS |
| SCN-TK-018 | implemented | sut.events names the events that arrived instead of the expected one |
| SCN-TK-019 | implemented | The scripted harness applies its edit and reports completion over ACP |
| SCN-TK-020 | implemented | A prompt the script does not name fails the scenario with the prompt shown |
| SCN-TK-021 | implemented | testkit conformance names each conformance scenario the adapter does not pass |
| SCN-TK-022 | implemented | An adapter that passes every conformance scenario of its port conforms |
| SCN-TK-023 | implemented | The module keeps its state in a private data folder |
| SCN-TK-024 | implemented | The sut refuses a module whose bin is a source file |
| SCN-TK-025 | implemented | A module that reaches a real host fails the scenario with the host shown |
| SCN-TK-026 | implemented | The testkit records which functions of the module its system tests ran |
| SCN-TK-027 | implemented | A scripted route gets its scripted answer |
| SCN-TK-028 | implemented | An unscripted request fails the test with the request shown |
| SCN-TK-029 | implemented | A route with "times" answers only that many requests |
| SCN-TK-030 | implemented | The fake gives the body of every request it received |
| SCN-TK-031 | implemented | fakes.collector runs the Collector config a module wrote and shows what it exported |
| SCN-TK-032 | implemented | fakes.collector shows the Collector log when the Collector exports nothing |
| SCN-TK-033 | implemented | sut.action runs the module's GitHub Action with its inputs |
| SCN-TK-034 | implemented | sut.action gives the action the event of the workflow run |
| SCN-TK-035 | implemented | An expression sut.action does not support fails the test |
| SCN-TK-036 | implemented | The module finds the browsers Playwright installed |
| SCN-TK-037 | implemented | A route with a content type answers its body as is |
| SCN-TK-038 | implemented | The first failing step ends the action with its exit code |
| SCN-TK-039 | implemented | A run step with a condition fails the test |
| SCN-TK-040 | implemented | An input the action does not declare fails the test |
| SCN-TK-041 | implemented | sut.action gives the action a job summary and returns its text |
| SCN-TK-042 | implemented | A scripted reply reports its token usage |
| SCN-TK-043 | implemented | The fake gives the headers of every request it received |
| SCN-TK-044 | implemented | The module runs the mutant that Stryker activates |
| SCN-TK-045 | implemented | sut.files.path gives the absolute path of a file in $INPUT |
| SCN-TK-046 | implemented | A library without a bin uses sut.files |
| SCN-TK-047 | implemented | documentedEnv gives the variables named in the Configuration section |
| SCN-TK-048 | implemented | readmeSection gives an empty text for a missing section |
| SCN-TK-049 | implemented | fakes.forge merges a pull request, so a module can read the merge commit |
| SCN-TK-050 | implemented | fakes.forge shows the pull request a module opens and the files of its branch |
| SCN-TK-051 | implemented | fakes.slack answers auth.test with the user of the module's messages |
| SCN-TK-052 | implemented | fakes.slack delivers a person's reply to the module's Events API signed with its signing secret |
| SCN-TK-053 | implemented | fakes.slack presses a button of the module's message and delivers the press to its interactivity URL |
| SCN-TK-054 | implemented | sut.http.stop stops the server so the test can start it again with another environment |
| SCN-TK-055 | implemented | Pressing a button that the message does not have fails the test with the button shown |
| SCN-TK-056 | implemented | sut.acp starts the module as an ACP agent and sends a prompt in a session |
| SCN-TK-057 | implemented | sut.acp refuses the agent's tool calls when asked to and lists them |
| SCN-TK-058 | implemented | sut.acp cancels the running turn of a session |
| SCN-TK-059 | implemented | The scripted harness asks to approve its tool calls and writes nothing when one is refused |
| SCN-TK-060 | implemented | A scripted turn waits for a steering message and then goes on |
| SCN-TK-061 | implemented | A waiting scripted turn ends with "cancelled" when the session is cancelled |
| SCN-TK-062 | implemented | A scripted turn that ignores cancel keeps running |
| SCN-TK-063 | implemented | A scripted turn ends with its scripted stop reason |
| SCN-TK-064 | implemented | sut.acp gives the exit code of a module that exits |
| SCN-TK-065 | implemented | A scripted Messages API call gets its scripted reply |
| SCN-TK-066 | implemented | A scripted Messages API reply streams a tool call |
| SCN-TK-067 | implemented | Messages API calls take the scripted replies in order, and the last one answers again |
| SCN-TK-068 | implemented | A scripted Messages API call that hangs gets no answer |
| SCN-TK-069 | implemented | A scripted Messages API reply ends with its scripted stop reason and token usage |
| SCN-TK-070 | implemented | A scripted turn reports its token usage and the session's cost |
| SCN-TK-071 | implemented | sut.acp.serve connects to an ACP agent that runs in the test's own process |
| SCN-TK-072 | implemented | A scripted turn takes a steering message sent as the request "_session/steering" |
| SCN-TK-073 | implemented | A scripted Responses API call streams its scripted reply and token usage |
| SCN-TK-074 | implemented | A scripted Responses API reply streams a function call and a custom tool call |
| SCN-TK-075 | implemented | A scripted Responses API call that hangs gets no answer |
| SCN-TK-076 | implemented | A streamed chat completions call gets its scripted tool call, finish reason and token usage |
| SCN-TK-077 | implemented | Streamed chat completions calls take the scripted replies in order, with the scripted finish reason |
