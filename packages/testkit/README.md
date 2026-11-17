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
| `testkit run --junit <file>` | Run `system-tests/**/*.test.ts` of the module in the current folder with globals, no retries, a 120 s test timeout and the global setup of `sut.shared`. Write the JUnit report to `<file>`. Exit 1 when a test fails. |
| `testkit conformance <port features folder> --junit <file>` | Run an adapter's system tests like `run`, then print `CONFORMANCE <id> passed` (or `failed`, `was skipped`, `has no system test`) for every implemented `@conformance` scenario in the folder and `N of M conformance scenarios passed`. Exit 1 unless all passed. |
| `testkit timed <command>...` | Run the command, a package's system tests, and exit with its code. Write its wall time, from its start to its end, to `reports/run-time.json` (`{"seconds": 12.345}`) for BUDGET, on CI and locally ([ADR 0155](../../docs/decisions/0155-budget-is-the-wall-time-of-a-suite.md)). |

## Writing a system test

See [`skills/write-system-test`](../../skills/write-system-test/SKILL.md). The context of `scenario` holds:

- `given`, `when`, `then`: step functions; each label repeats the scenario's step text.
- `example`: the row of a Scenario Outline's `Examples` that this run tests, by column name (ADR 0157). The test of
  an Outline reads the rows from the feature file by the scenario ID and runs its body once for each row, in turn,
  each with a workspace, fakes and `sut` of its own. Labels keep the parameters `<name>` as the feature file writes
  them; a failed step shows the row's values in their place. The test is one test case in the JUnit report, named
  after the scenario: it fails when any row failed and says `N of M examples of <id> failed`, with each failed row
  and its values; a planned Outline fails when every row passed. The rows share the test's timeout. Name the
  columns, `scenario<"field" | "message">(id, fn)`, to read `example.field` as a string; for a plain scenario
  `example` is empty.
- `sut.cli(args, { env, stdin })`: runs the module's `bin` in its own process, with `$INPUT` as the current directory.
  `stdin` is written to the program's standard input, which is then closed.
  The module gets `INPUT` and `OUTPUT` (the two folders), `OSF_DATA` (its private data folder, which persists
  for the scenario and which the test has no path into), `OSF_NOW=2026-01-01T00:00:00Z` and `OSF_SEED=1`.
  `env` may only name variables the module's README documents under Configuration. `bin` must be the built
  artifact: a `bin` in `src/` fails the test (BOUNDARY-RUNTIME).
- `sut.files`: `put`, `link`, `read`, `mode`, `list`, `remove` and `clear` in the module's input and output folders. Every path
  starts with `$INPUT/` or `$OUTPUT/` and stays inside that folder; any other path fails the test. `path` gives
  the absolute path of a file there, for a library in `packages/` whose functions take paths (ADR 0039).
  `link(path, target)` makes a symbolic link at `path` with the text `target` as its target, which may point
  anywhere, as a link in a repository that a module fetches can.
  `put(path, content, { executable: true })` writes a file its owner can run, like a fake program or plugin, and
  `put(path, content, { mode: 0o644 })` gives it those permission bits. `mode(path)` reads them back, like `0o600`
  for a file of secrets that only its owner reads. `put`
  writes a text as UTF-8 and a `Uint8Array`, such as a `Buffer`, byte for byte.
- `sut.readme`: `quickStartArgs()` (the arguments of the README's `npx <package> ...` line) and
  `quickStartOutput()` (the first `$OUTPUT/<file>` it names).
- `sut.git`: `$INPUT` is a Git repository with a fixed author and clock.
- `sut.http.start(args, { env })`: starts the module's `bin` as a server with the same environment as `sut.cli`
  plus `PORT`, waits until it listens on `127.0.0.1:PORT` and returns the base URL. `PORT` is a free port that no
  other worker process picked in the last minute, so a parallel scenario's server cannot answer for this one. Then `get`, `post` and
  `request` call it (the body is parsed for `application/json` and any `+json` type, such as
  `application/problem+json`), `stop()` stops it so the test can start it again, for example with another
  environment, and `client<paths>()` gives an [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) client
  typed by the module's generated OpenAPI `paths`. A server that exits first fails the test with its error output.
  `url()` gives the base URL of the running server.
- `sut.pages.open(path, { headers })`: opens a page of the server `sut.http` started, as a person reads it but
  without a browser ([ADR 0131](../../docs/decisions/0131-ui-tests-pages-journeys-islands.md)). The page has its
  `status`, `path`, `location` (of a redirect that was not followed), `title`, `text`, `refresh` (the seconds of its
  `<meta http-equiv="refresh">`), `stylesheets`, `hasScript`, `theme` (the `data-theme` of its root element, as the
  server chose it) and `forms`, and Testing Library's queries
  `getByRole`, `queryByRole`, `getAllByRole`, `queryAllByRole`, `getByText`, `queryByText`, `getAllByText` and
  `getByLabelText`. Each element found has its accessible `name`, its `text`, `attribute(name)` and the same
  queries inside it. `follow(link)` opens a link by its name; `submit(button, { label: value }, { follow, headers })`
  presses a button and sends its form with the fields named by their labels. Links and forms send the page's headers
  again and keep the scenario's cookies; redirects are followed unless `follow` is false. `sut.pages.send(path,
  fields, { headers, follow })` sends fields as a form does, for a request that no page offers, like a program's. A
  test finds elements by role, name, label and text, never by a tag, a class or a test ID.
- `sut.browser.open(path, { viewport, headers, clock })`: opens a page of the folder `sut.site` serves, or else of the
  server `sut.http` started, in Chromium and returns Playwright's `Page`, for a journey or an island scenario (ADR 0131). One browser per test process, a new
  context per scenario: the testkit's clock (2026-01-01T00:00:00Z), the locale `en-US`, the time zone `UTC`, reduced
  motion and the viewport `phone` (390 × 844) or `desktop` (1280 × 800, the default). A request that leaves loopback
  is refused, and it, an error in the browser's console or the page's script and a failed request fail the scenario.
  `expectAccessible(page)` runs axe-core and fails on a violation; `screenshot(page, name)` keeps
  `reports/screenshots/<scenario ID>/<name>.png` as the journey's evidence. Find elements with `getByRole`,
  `getByLabel` and `getByText` only. Install the browser once with `make browser`. When the test process has
  `__STRYKER_ACTIVE_MUTANT__`, as during `osf mutation`, every page of the scenario gets
  `globalThis.__stryker__ = { activeMutant }` before its first script, where Stryker's instrumented code reads it, so
  a mutant in an island's bundled code is active in the browser
  ([ADR 0152](../../docs/decisions/0152-an-islands-code-counts.md)). The browser's clock stands at the testkit's
  clock while its timers run in real time; with `clock: "paused"` it stands still from before the page's first
  script, so a timer runs only when the test runs `page.clock.runFor(ms)`, exactly that many milliseconds later, as
  an island scenario needs (SCN-TK-189). Playwright's actions such as `fill` wait for animation frames, which a paused
  clock holds back: resume it with `page.clock.resume()` first, and before `expectAccessible`.
- `sut.site.serve(folder, { headers })`: serves a folder of the unit, such as the built workbench of `@opensoftware/ui`,
  on `127.0.0.1` until the scenario ends and returns its base URL; `sut.site.url()` gives it again. A path answers
  its file, or a folder's `index.html`, with the file's content type (HTML, JavaScript, CSS, JSON, SVG, else
  `application/octet-stream`) and the `headers`, such as the console's Content-Security-Policy. A path outside the
  folder, also through an encoded `..` or a symbolic link, answers 404, and a folder outside the unit is refused
  (ADR 0152).
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
  `approve: false`, and lists them in `permissionRequests()`. `exited()` waits for the module to exit and gives its exit code.
  `hangUp()` closes the connection and ends the module's standard input, as a client that ends does. It offers the module no file system and no terminal.
- `sut.acp.serve(start, { approve })`: the same client for a library that serves ACP in the test's own process, such
  as `@opensoftware/harness-proxy` ([ADR 0052](../../docs/decisions/0052-harness-claude-code.md)). `start` gets the
  streams `{ input, output }` to serve on; `exited()` gives 0 when its promise resolved and 1 when it rejected.
- `sut.events.watch(nats, subjects)`: records the CloudEvents published on a NATS server from now on.
- `sut.events.stream(nats, name, add?)`: the JetStream stream `name` (its `subjects`, `maxAgeMs` and `messages`), or
  undefined; with `add` (`subjects`, `maxAgeMs`) it first adds the stream, as another module would.
  `received(type, { count, timeoutMs })` waits for them and, on timeout, names what arrived instead;
  `publish(subject, event)` sends an event to the module.
- `sut.compose("<file>")`: a Compose file of the unit, like `compose/compose.yaml` of `deploy/`
  ([ADR 0074](../../docs/decisions/0074-compose-profile.md)). `run(args, { env })` runs `docker compose <args>` as the
  scenario's own project with `$INPUT/.env` as its `.env`; `services()` lists each service's state, health and exit
  code; `url(service, port)` is where the project publishes that container port. The project and its volumes are
  removed when the scenario ends, without a grace period for its containers to stop.
- `sut.helm("<chart>")`: a Helm chart of the unit, like `helm/osf` of `deploy/`
  ([ADR 0075](../../docs/decisions/0075-helm-chart-and-images.md)), on the cluster of `KUBECONFIG`. `chart` is the
  chart's absolute path; `run(args)` runs `helm <args>` and `kubectl(args)` runs `kubectl <args>`, both in a namespace
  of the scenario, with $INPUT as the current directory; `url(service, port)` forwards a local port to that port of
  the service. When the scenario ends, each release of the namespace is uninstalled, with its objects outside the
  namespace, like a namespace of its own, and then the namespace is deleted (SCN-TK-137). `make install` pins helm,
  kubectl and kind.
- `sut.shared("<name>", start)`: one start of a slow system for the scenarios tagged `@shared=<name>`, which only
  read it ([ADR 0157](../../docs/decisions/0157-the-testing-rule-shared-starts-outlines-and-wording.md),
  [ADR 0162](../../docs/decisions/0162-a-shared-start-is-once-per-test-run.md)). The first scenario of the group in
  the test run calls `start` with the group's workspace: its `files`, and `compose(file)` and `helm(chart)` on the
  group's project and namespace. Every scenario of the group, in any test process, then gets
  `{ sut, result }`: the same workspace and what `start` returned, as JSON (SCN-TK-210, SCN-TK-213). When `start`
  throws, each scenario of the group fails with `the shared start "<name>" failed in <scenario>: <failure>`
  (SCN-TK-211). The project and the namespace go down when the run ends, also after a failure. What a scenario starts
  on them, like a port-forward of `url`, stops with the scenario. A scenario without the tag cannot call it, and a
  scenario with the tag fails when it did not (SCN-TK-212). It needs the global setup: `testkit run` has it, and a
  package that runs vitest itself names `globalSetup: ["@opensoftware/testkit/global-setup"]` in its config.
- `sut.adapter("<port>/<name>")`: the command line of a port adapter of this repository, `adapters/<port>/<name>/` in
  the module's folder or above it: Node and the adapter's built `bin`. Pass it to a module that runs adapters as
  programs in its documented variable; the adapter runs as the module's child, with its network guard. The adapter
  must be built: name its build in the module's `turbo.json` ([ADR 0060](../../docs/decisions/0060-factory-spec-forge-port.md)).

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
  first matching entry. `calls` lists every call with its `path`, `body` and `headers` (names in lower case). `fakes.modelGateway(script,
  { containers: true })` listens on every interface and also gives `containerUrl`,
  `http://host.docker.internal:<port>/v1`, as `fakes.http` does ([ADR 0076](../../docs/decisions/0076-e2e-smoke-suite.md)).
- `fakes.http([{ method, path, status, body, contentType, headers, times, until }])`: a scripted JSON API on `127.0.0.1`
  ([ADR 0021](../../docs/decisions/0021-testkit-scripted-http.md)). Pass its `url` to the module through its
  documented config. A request whose method (default `GET`) and exact path with query match a route gets its
  `status` (default 200) and JSON `body`; a route with `times` answers only that many requests, and later ones go to
  the next matching route, for example an outage before a success ([ADR 0023](../../docs/decisions/0023-runlog.md)).
  A route with `contentType`, such as `text/html`, answers its `body` text as is, for example a page to capture.
  A route with `headers` adds them to its answer, for example the `Api-Version` of a stand-in Docker daemon.
  A route with `until` (a promise) answers only after the promise settles, for example to hold a module in the
  middle of a transaction. The fake reads `until`, `status` and `body` when it answers, so a test can change them on
  a route it already gave the fake.
  Any other request gets HTTP 404 and fails the scenario with the request shown. `requests()` lists what it
  received as `METHOD /path`; `received()` lists each request with its `body` (JSON, or text when it is not JSON;
  a gzip body is unpacked first); `headers()` lists each request with its headers, names in lower case
  ([ADR 0032](../../docs/decisions/0032-scorekit.md)); `texts()` lists each request with the text of its body as it
  arrived, for a signature over its bytes ([ADR 0057](../../docs/decisions/0057-forge-port.md)). `fakes.http(routes, { containers: true })` listens on every
  interface instead and also gives `containerUrl`, `http://host.docker.internal:<port>`, for a module that reaches the
  fake from a container, such as a sandbox's egress proxy. Docker Desktop maps that host to the Docker host; on Linux
  the container needs `--add-host host.docker.internal:host-gateway`
  ([ADR 0054](../../docs/decisions/0054-sandbox-port.md)). `hostUrls()` gives the fake at every address of this
  host but loopback and link-local, read when called, for a scenario that proves a container cannot reach the host
  by its addresses, such as SCN-SANDBOX-030.
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
  ([ADR 0053](../../docs/decisions/0053-harness-codex-opencode.md)). Session IDs are `session-1`, `session-2`, … across
  every process of the agent, so two stages never share one. `sessions()` lists each session the agent opened,
  with its `cwd` and the variables `OPENAI_*`, `ANTHROPIC_*` and `OSF_EFFORT` the agent got in `env`, so a test sees
  which model gateway, key, model and effort level a module handed the harness
  ([ADR 0070](../../docs/decisions/0070-foreman-gateway-and-take-over.md), [ADR 0078](../../docs/decisions/0078-agent-effort.md)),
  and the `mcpServers` of `session/new` as ACP sent them
  ([ADR 0112](../../docs/decisions/0112-an-agents-mcp-servers-and-skills-in-its-session.md)).
  A turn with `commands` runs each with `sh -c` in the session's folder after its edits, as a coding agent's tools
  do; their output comes before the `reply`. A command that exits with another code than 0 ends the turn with
  `refusal` and fails the scenario with its output; `commands()` lists each with its `exitCode` and `output`.
  `fakes.harness(script, { containers: true })` lets a module run the agent in a container: `command` is then `node`
  and `mounts` names the agent's code folder and its script folder, which the container mounts at the same paths
  ([ADR 0076](../../docs/decisions/0076-e2e-smoke-suite.md)). `fakes.harness(script, { sandboxes: { agent } })` is for
  a sandbox, which mounts nothing: its template holds the file `HARNESS_AGENT` (also `@opensoftware/testkit/harness-agent`)
  at `agent`, with the ACP SDK where the file finds it, and the agent takes its script and sends its log over HTTP at
  `host.docker.internal`, which the sandbox's egress must allow
  ([ADR 0096](../../docs/decisions/0096-agents-in-sandboxes-in-the-profile.md)).
- `fakes.sandbox({ templates, probe, takesMs, held })`: a sandbox adapter with the commands `create`, `exec`, `copy`, `destroy`,
  `list` and `probe` of the [sandbox port](../../ports/sandbox/README.md), whose sandboxes are folders on the host, for a module that
  drives the port without Docker ([ADR 0068](../../docs/decisions/0068-foreman-sandboxes.md)). Run it with its
  `command` and `args`, then the port's command. Its IDs are `000000000001` and on. `exec` runs the command in the
  sandbox's folder with the spec's `env` and `osf-secret-placeholder-<NAME>` for each secret; `copy` maps `<ID>:<path>`
  to that folder. With `templates`, `create` refuses another template with `no template <name>` and exit code 1.
  With `takesMs: { create, copyOut }`, `create` answers that many milliseconds after it created the sandbox, and a
  `copy` out of a sandbox starts that much later, as a slow image pull or a large folder would.
  `list --label <name>=<value>` prints only the sandboxes whose spec has that label. With `held`, a list of specs, the
  fake holds those sandboxes from its start, `000000000001` and on, as a process before the module left them; its
  own IDs go on after them, and `created()` does not name them ([ADR 0158](../../docs/decisions/0158-no-sandbox-is-left-behind.md)).
  `probe <template> <host>` creates a sandbox with no allowed host, removes it and prints `refused <host>`, or
  `reached <host>` with `probe: "reached"`, as it cannot refuse anything itself.
  `created()` lists each sandbox's ID and spec, `execs()` each command with the files in the folder when it started,
  `probes()` each probe's sandbox, template and host, and `list()` the sandboxes that exist. It isolates nothing.
- `fakes.inference({ url, fails, startFails, revokeFails })`: an inference adapter with the commands `start`, `key`,
  `revoke`, `spend-log`, `stop` and `list` of the [inference port](../../ports/inference/README.md), for a module that drives the port without LiteLLM
  and Docker ([ADR 0070](../../docs/decisions/0070-foreman-gateway-and-take-over.md)). Run it with its `command` and
  `args`, then the port's command. `start <config>` prints `{"id", "url"}` with the IDs `000000000001` and on and the
  `url` of the options (default `http://127.0.0.1:4000/v1`); it serves nothing there, so pass the URL of
  `fakes.modelGateway` when a test needs answers. `key <ID> <run ID> [--budget <USD>]` prints `sk-fake-1` and on,
  the same key for the same run of a gateway until `revoke <ID> <run ID>` (ADR 0108); `spend-log` prints nothing;
  `stop` removes the gateway. With `fails`, every command exits 1 with that message. With `startFails`, `start` exits 1
  with that message until the test calls `ready()`. With `revokeFails`, `revoke` exits 1 with that message. The test
  reads `started()`, `keys()` (one per run), `revoked()` and `list()`.
  `started()` lists each gateway's ID and the text of its config, `keys()` each key with its `gateway`, `run` and
  `budget`, and `list()` the gateways that exist.
- `fakes.postgres()`: a new, empty database for this scenario in PostgreSQL 17, a container that the test process
  starts once ([ADR 0129](../../docs/decisions/0129-one-postgres-and-one-temporal-per-test-process.md)). Docker must
  run. The module connects to `postgres://test:test@127.0.0.1:<port>/<database>` with its own driver; a wrong
  password is refused with SQLSTATE 28P01. `stop()` stops the database while the test runs: open connections end,
  also one in the middle of a transaction, and new ones are refused, as when a server goes away. The server keeps
  running for the next scenario.
- `fakes.nats()`, `fakes.temporal()`: NATS with JetStream and the Temporal CLI's dev server, each
  the real server as a process on the host with its data in a temporary folder, with no Docker
  ([ADR 0067](../../docs/decisions/0067-foreman.md)). NATS starts for this scenario. The Temporal server starts once
  for the test process, and each scenario gets a new `namespace` in it, which the test passes on to the module
  ([ADR 0129](../../docs/decisions/0129-one-postgres-and-one-temporal-per-test-process.md)). `make install` pins `nats-server` 2.11.9 and `temporal` 1.4.1 in
  `.tools/bin`; on other platforms put the same versions on PATH. Each starts in about a second. Their ports come
  from 10000 to 19999 and a module's port from 20000 to 32767, so a service of a parallel scenario cannot take the port
  of a module that does not listen yet. A server that another process beats to a port, or that is not ready after
  10 s, starts again on new ports, at most three times; the error names what it wrote.
- `fakes.openbao()`: OpenBao 2.7.2's development server, the real server as a process on the host with its data in
  memory ([ADR 0137](../../docs/decisions/0137-secrets-port-write-side-and-openbao.md)). The test process starts it once,
  like Temporal, and each scenario gets a KV version 2 `mount` of its own at `url`, which the test passes on to the
  module. `token(policy, { ttl })` makes a token with the policy, in OpenBao's policy language, that lives `ttl`
  (default `1h`). `read(name)` gives the current `version` and the `data` of a secret in the mount, or undefined, and
  `write(name, data)` stores a new version, as another client of OpenBao does. The root token stays in the fake.
  `make install` pins `bao` 2.7.2 in `.tools/bin`. `fakes.openbao({ containers: true })` also answers containers: a
  second server of the test process listens on every interface, and `containerUrl` is the same server at
  `host.docker.internal`, which a sandbox's egress proxy reads
  ([ADR 0139](../../docs/decisions/0139-git-basic-form-value-timing-and-the-check-before-a-stage.md)). The server for
  the host stays on loopback.
- `fakes.s3()`: a real service in a container for this scenario
  ([ADR 0016](../../docs/decisions/0016-testkit-service-fakes.md)). Each fake gives only what a module needs
  to reach it: a URL, an address or an endpoint with keys. Docker must run.
- `fakes.forge()`: a real Forgejo with a user and an API token (`url`, `token`, `owner`). The test process starts one
  and gives each scenario that asks for it the forge without the repositories of the scenarios before
  ([ADR 0064](../../docs/decisions/0064-shared-forge-per-test-process.md)). The test can
  `createRepository`, `openPullRequest` and `mergePullRequest`, read the `comments` of a pull request or an issue and a pull request's `statuses`,
  list the repository's `pullRequests` (title, body, head and base branch, state, URL) a module opened, and read a
  `file` on a branch ([ADR 0046](../../docs/decisions/0046-observer.md)). It can `createBranch` with a commit of
  files, list the `branches` with their head commits and the `hooks` with their URL, events and state, and `review` a
  pull request as the person `reviewer` (`APPROVED`, `REQUEST_CHANGES` or `COMMENT`). It can `openIssue` and `label`
  an issue, which creates the label when the repository has none of that name
  ([ADR 0065](../../docs/decisions/0065-intake-issues-and-alerts.md)). Its webhooks reach a fake for
  containers at `host.docker.internal`, so a test receives a real delivery
  ([ADR 0057](../../docs/decisions/0057-forge-port.md)).
- `fakes.github()`: an in-process fake of the part of GitHub's REST API a forge client calls, with the same interface
  as `fakes.forge()` and no Docker ([ADR 0058](../../docs/decisions/0058-forge-github.md)). `url` is the API's base,
  `token` the token of the user `tester`, sent as `Bearer` or `token`; any other token gets 401 `Bad credentials`.
  It keeps commits with their files, refs, pull requests numbered per repository (`mergeable` is `null` on the first
  read), which it lists by state and page, three-way merges with conflicts, commit statuses and the combined status, check runs that a test adds with
  `checkRun(pr, { name, status, conclusion, title })` and that it lists by page (`noChecksToken` may not read them
  and gets 403, [ADR 0104](../../docs/decisions/0104-forge-github-check-runs.md)),
  comments, which it lists by page as GitHub does (30 to a page, up to 100 with `per_page`), reviews, which it lists per pull request, branch protection that holds for admins only with `enforce_admins` and that it reads back (404
  `Branch not protected` without one), closing a pull request, the Git Data API's refs, commits, blobs (`utf-8` or `base64`, named
  by Git's SHA) and trees on a `base_tree` of entries with their text or a blob's `sha`; `fileBytes(repository,
  path, ref)` gives a file's bytes, the rules of the rulesets that `addRuleset(repository, { branches, checks,
  approvals })` added for a branch (`GET .../rules/branches/{branch}`, not enforced on merges), which moves a branch only forward unless the update is forced
  ([ADR 0136](../../docs/decisions/0136-forge-port-changes-from-the-ui.md)), auto-merge through `POST /graphql`
  (a pull request's `mergeStateStatus`, its `autoMergeRequest` and its repository's `autoMergeAllowed`, and
  `enablePullRequestAutoMerge`, refused unless `allowAutoMerge(repository)` allowed it and for a pull request that
  can merge now, and failing the scenario when auto-merge is on already, since GitHub does not document that
  answer; a commit status that makes the merge rules hold merges it), `calls()` with each call it answered as
  `<method> <path with its query>`, and webhooks, which it lists, updates and deletes: a
  signed `ping` when one is created, then
  `pull_request`, `pull_request_review`, `issue_comment` and `issues` (`opened`, `labeled`, and `unlabeled` after `unlabel(repository, number, label)`) deliveries with
  `X-Hub-Signature-256`, sent only to URLs on
  `127.0.0.1` or `localhost`, all at the same time; `delivered()` resolves once each delivery so far got its answer. IDs, SHAs and times come from counters and the fixed clock. A call it does not know
  answers 404 and fails the scenario. For a chat client, `GET /user` answers the token's user, a pull request's
  comments can be listed, `say(pr, text, as)` comments as a person (`reviewer` by default) and delivers the
  `issue_comment` event, and `conversation(pr)` gives each comment with its author
  ([ADR 0059](../../docs/decisions/0059-channel-port.md)). `openIssue` and `label` keep issues numbered with the pull
  requests, and `GET /repos/{owner}/{repo}/issues/{number}` answers one with its labels (ADR 0065). `POST
  /repos/{owner}/{repo}/issues/{number}/comments` also comments on an issue, without a webhook delivery (ADR 0113).
- GitHub's sign-in in `fakes.github()` (ADR 0134): `oauth` holds the OAuth app's `clientId` and `clientSecret`;
  `signIn({ login, email, name, verified })` names the person whom the next `GET /login/oauth/authorize` signs in.
  It redirects at once with a code (or `error=access_denied` without a person), `POST /login/oauth/access_token`
  trades the code for a token, and with that token `GET /user` gives the login and name and `GET /user/emails` the
  primary email and whether it is verified. A trade with another client or a used code fails the scenario.
- `fakes.oidc({ containers })`: an OpenID Connect provider in the test process
  ([ADR 0134](../../docs/decisions/0134-console-sign-in-roles-and-modes.md)) at `url`, with its discovery document,
  authorization and token endpoints and keys, and the client `clientId` and `clientSecret`. `signIn({ email, name,
  verified })` names the person whom the next authorization signs in; the authorization endpoint redirects at once with
  a code, or with `error=access_denied` when nobody was named. The ID token is signed with RS256 and dated on the
  testkit's clock (2026-01-01T00:00:00Z), so a module with `OSF_NOW` accepts it. A token request with another client,
  secret, redirect address or PKCE verifier fails the scenario. `received()` lists the paths it was asked for.
- `fakes.personIssuer({ name, containers })`: an issuer of person proofs in the test process
  ([ADR 0151](../../docs/decisions/0151-the-person-proven-to-every-module.md)), named `name` ("console" by default).
  It serves its key set (format `person-keys`, one Ed25519 key made for the test run and never written down) at `url`,
  `/.well-known/jwks.json`, and gives `keys`, the same set, and `setting`, `<name>=<url>`, the value of a module's
  `<MODULE>_PERSON_KEYS`. `prove(claims, header)` gives a signed proof for the header `OSF-Person`: `claims` names
  `sub`, `aud` and `path`, and the rest has defaults: `iss` the issuer's name, `role` "member", `method` "POST", `iat`
  the testkit's clock (2026-01-01T00:00:00Z), `exp` 30 seconds later, and `bodyDigest` the SHA-256 of `body` (empty by
  default) in base64url. A claim set to `undefined` is left out, and any other claim is added. `header` changes `typ`
  (default "osf-person+jwt"), `alg` ("Ed25519", or "EdDSA" for a proof a module must refuse) and `kid` (the key's
  thumbprint). So a module's system test proves both "accepted" and "refused" without the console. `fetched()` counts
  the fetches of the key set; any other request fails the scenario.
- `fakes.personProof(proof, keys, body)`: reads a person proof that the module sent, as a fake received it in
  `OSF-Person`, for a test of an issuer like the console. It gives `verified`, whether the key of the key set at the URL
  `keys` that the proof's `kid` names verifies its Ed25519 signature, the `header` and the `claims`, and
  `bodyMatches`, whether `bodyDigest` is the SHA-256 of `body` (empty by default), the text the fake received. It
  checks no time: the test expects the claims.
- `fakes.sentry()`: a fake of Sentry's integration platform with a `clientSecret`. `alert(url, {title, level,
  release, rule})` sends the URL an `event_alert` of the rule (default "Fatal errors") signed in
  `Sentry-Hook-Signature` with the client secret, or with a third argument instead, and gives the Sentry issue's ID,
  the event's link and the webhook's status. IDs come from a counter; it sends only to `127.0.0.1` or `localhost`
  ([ADR 0065](../../docs/decisions/0065-intake-issues-and-alerts.md)).
- `fakes.collector(config)`: the real OpenTelemetry Collector Contrib in a container, running the config text a
  module wrote ([ADR 0025](../../docs/decisions/0025-runlog-collector-config-pack.md)). The config receives OTLP/HTTP
  on `0.0.0.0:4318` and exports to `${env:OTEL_EXPORTER_OTLP_ENDPOINT}`, which the fake points at its own receiver.
  `send(request)` posts an OTLP/JSON request to the Collector; `exported({ count, timeoutMs })` waits for the
  requests the Collector exported (JSON encoding) and, on timeout, shows the Collector's log. Docker must run.
- `fakes.traceStore({ keep })`: an in-process trace store on `127.0.0.1`: an OTLP/HTTP receiver of JSON traces at
  `otlpUrl` + `/v1/traces`, and Jaeger's query API `GET /api/traces/{traceId}` at `queryUrl`, which answers the
  received spans of that trace or 404. `spans()` lists every span it took with its service. With `keep: false` it
  takes spans and keeps none, like a collector whose exporter is broken
  ([ADR 0120](../../docs/decisions/0120-deep-checks-of-console-doctor.md)).
- `fakes.slack()`: a fake Slack Web API (`auth.test`, `chat.getPermalink`, `chat.postMessage`,
  `conversations.history`, `conversations.replies`, `reactions.add`, `users.info`) at `url` with `token`.
  `users.info` knows the bot as `factory` and the default person `U0PERSON` as `Varun`; `chat.getPermalink` links a
  message as `https://testkit.slack.com/archives/<channel>/p<ts>` (ADR 0059). `auth.test` answers the bot's user ID `bot`, which
  every message the module posts carries. The test reads `messages(channel)`, with the `buttons` of each message's
  `actions` blocks, and posts as a person with `say`. Any other method fails the scenario. `deliverTo(events,
  interactivity)` names the module's request URLs: `say` then also sends a `message` event, and `press({ channel,
  ts, actionId, user })` sends a `block_actions` payload for a button of a message. Both are signed like Slack with
  the fake's `signingSecret` and the fixed clock, so the module checks them as it would check Slack; `sign(body)`
  gives the same headers for a request the test sends itself
  ([ADR 0048](../../docs/decisions/0048-gatekeeper-server.md)).
  `fakes.slack({ containers: true })` listens on every interface and also gives `containerUrl`,
  `http://host.docker.internal:<port>/api/`, for a module in a container ([ADR 0076](../../docs/decisions/0076-e2e-smoke-suite.md)).

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
  `reports/coverage/` of the module ([ADR 0019](../../docs/decisions/0019-reach-from-process-coverage.md)), next to
  its `reports/junit.xml`, so that turbo replays both ([ADR 0081](../../docs/decisions/0081-cached-system-tests-on-pull-requests.md)).
  `osf collect-reports` copies them to `reports/` of the workspace, and `osf check REACH` fails on lines a pull
  request adds that no system test reaches.
  A process whose entry script is another package of this repository, like an adapter the module starts, records
  nothing: it cannot run the module's code (ISOLATION), and V8's coverage makes each start slower. Both guards are plain JavaScript, so a
  process loads them without stripping types.
- Every Node process of the module, and the processes it starts, shares Node's compile cache (`NODE_COMPILE_CACHE`
  in the system's temporary folder): a start loads the code an earlier one compiled, which saves 0.1 to 0.3 s each.
- The clock and the seed are fixed through `OSF_NOW` and `OSF_SEED`; a module reads them instead of the system
  clock and a random seed.

## Configuration

The testkit reads these environment variables:

| Variable | Meaning |
| --- | --- |
| `PLAYWRIGHT_BROWSERS_PATH` | Where Playwright keeps its browsers. The module gets it like `PATH`, since its `HOME` is the working folder. |
| `__STRYKER_ACTIVE_MUTANT__` | The mutant Stryker activates during a mutation run (`osf mutation`, ADR 0037). The module's instrumented build reads it in its own process, and `sut.browser` sets it in every page before its first script (ADR 0152). |
| `DOCKER_HOST` | The Docker daemon, as for any `docker` command, such as `unix://$HOME/.rd/docker.sock` of Rancher Desktop. The module's processes get it like `PATH`, so a module that starts containers and the fakes reach the same daemon. Default: Docker's own (`/var/run/docker.sock`). |
| `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`, `TESTCONTAINERS_HOST_OVERRIDE` | How testcontainers reaches the daemon of a Docker that runs in a VM, such as Rancher Desktop: the socket path in the VM, which Ryuk mounts, and the host of the mapped ports. The module's processes get them like `DOCKER_HOST`. |
| `DOCKER_CONFIG` | The Docker CLI's configuration folder. `sut.compose` lets `docker` find the plugins in its `cli-plugins/`, like `docker compose`, and nothing else from it, since the module's `HOME` is the working folder. Default: `~/.docker`. |
| `KUBECONFIG` | The cluster where `sut.helm` installs charts, as for any `kubectl` command. Its current context must be a local kind cluster, `kind-*` with a server on the loopback address: `sut.helm` refuses any other cluster before its first command (SCN-TK-132). Without it, `kubectl` finds no cluster, since its `HOME` is the working folder. The module does not get it unless the test passes it on. |
| `OSF_TESTKIT_MUTANTS` | A folder, set by `osf mutation` for its first test run ([ADR 0061](../../docs/decisions/0061-mutation-runs-the-scenarios-that-reach-a-mutant.md)). Each process of the module writes the IDs of the mutants it ran to `<folder>/<scenario ID>/` when it exits. |
| `OSF_TESTKIT_RUN` | An ID of the run, set by `osf mutation` for each run of a mutant ([ADR 0084](../../docs/decisions/0084-nightly-mutation-shards-and-replays.md)). Every container of the fakes carries the label `org.opensoftware.run` with this ID, so the runner removes the containers of a run when it ends. |

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
| SCN-TK-078 | implemented | A fake for containers answers a request from a container |
| SCN-TK-079 | implemented | A name with a star in the Configuration section documents every variable with that prefix |
| SCN-TK-080 | implemented | fakes.forge delivers a pull request's webhook to a fake for containers |
| SCN-TK-081 | implemented | fakes.forge creates a branch with a commit and lists the branches and webhooks of a repository |
| SCN-TK-082 | implemented | fakes.forge reviews a pull request as the person "reviewer" |
| SCN-TK-083 | implemented | The fake gives the text of each request body as it arrived |
| SCN-TK-084 | implemented | fakes.github shows the pull request, the status and the comment a module posts |
| SCN-TK-085 | implemented | fakes.github squashes a pull request into "main" with the files of its branch |
| SCN-TK-086 | implemented | fakes.github refuses a merge that the branch protection of "main" forbids |
| SCN-TK-087 | implemented | fakes.github delivers a signed ping and a pull request event to a webhook a module registers |
| SCN-TK-088 | implemented | fakes.github answers 401 to a token it did not issue |
| SCN-TK-089 | implemented | A GitHub call fakes.github does not support fails the test with the call shown |
| SCN-TK-090 | implemented | fakes.slack answers users.info with the person's name and chat.getPermalink with a link to the message |
| SCN-TK-091 | implemented | fakes.github delivers a person's comment in a pull request's conversation to a module's webhook |
| SCN-TK-092 | implemented | fakes.github answers the token's user and the comments of a pull request's conversation |
| SCN-TK-093 | implemented | sut.adapter gives the command of a port adapter that the module runs |
| SCN-TK-094 | implemented | sut.adapter names an adapter the repository does not have |
| SCN-TK-095 | implemented | fakes.github removes the webhook a module deletes |
| SCN-TK-096 | implemented | The module records for its scenario the mutants its process ran |
| SCN-TK-097 | implemented | fakes.forge comments on a pull request as the person "reviewer" |
| SCN-TK-098 | implemented | fakes.github answers the changed files, the labels and the draft flag of a pull request |
| SCN-TK-099 | implemented | fakes.github has a token like a GitHub Actions token that may not read its user |
| SCN-TK-100 | implemented | fakes.slack lists the messages at the top of a channel newest first, without the replies in threads |
| SCN-TK-101 | implemented | fakes.forge gives a later scenario the same forge without the repositories of the earlier one |
| SCN-TK-102 | implemented | fakes.github answers an issue that a test opened and labeled |
| SCN-TK-103 | implemented | fakes.forge opens an issue and adds a label to it |
| SCN-TK-104 | implemented | fakes.sentry sends a module's webhook an alert signed with the integration's client secret |
| SCN-TK-105 | implemented | The fake sandbox runs a command in its folder with the spec's variables and a placeholder for each secret |
| SCN-TK-106 | implemented | A folder copied into the fake sandbox and out again keeps its files |
| SCN-TK-107 | implemented | A destroyed fake sandbox leaves the list and refuses commands |
| SCN-TK-108 | implemented | The fake sandbox refuses a template outside its list |
| SCN-TK-109 | implemented | The scripted harness records each session's folder and model variables |
| SCN-TK-110 | implemented | The fake inference adapter starts a gateway from a config and prints its ID and URL |
| SCN-TK-111 | implemented | The fake inference adapter makes one key per call and forgets a stopped gateway |
| SCN-TK-112 | implemented | The fake inference adapter fails every command with its message |
| SCN-TK-113 | implemented | fakes.github lists the open pull requests and the reviews of a pull request |
| SCN-TK-114 | implemented | sut.compose starts a Compose file of the module and reaches the port a service publishes |
| SCN-TK-115 | implemented | sut.helm installs a chart of the module in the scenario's namespace and reaches the port of a service |
| SCN-TK-116 | implemented | fakes.slack for containers shows the message a module posts from a container |
| SCN-TK-117 | implemented | A scripted turn runs its commands in the session's folder and replies with their output |
| SCN-TK-118 | implemented | A scripted command that fails ends the turn with "refusal" and fails the scenario with its output |
| SCN-TK-119 | implemented | A scripted harness for containers answers a module that runs it in a container |
| SCN-TK-120 | implemented | The model gateway for containers answers a call from a container |
| SCN-TK-121 | implemented | The scripted harness records each session's effort level |
| SCN-TK-122 | implemented | sut.compose runs docker with the developer's Docker configuration, where Docker finds its plugins |
| SCN-TK-123 | implemented | A module reaches a local socket by its path under the network guard |
| SCN-TK-124 | implemented | The model gateway keeps the headers of each call |
| SCN-TK-125 | implemented | A stopped fakes.postgres refuses the module's connection |
| SCN-TK-126 | implemented | A route with "until" answers only after its promise settles |
| SCN-TK-127 | implemented | A test may stop fakes.postgres while a client holds a transaction open |
| SCN-TK-128 | implemented | The processes of a mutation run record no coverage |
| SCN-TK-129 | implemented | The containers of the fakes carry the label of the run that OSF_TESTKIT_RUN names |
| SCN-TK-130 | implemented | The module's processes reach Docker through the Docker settings of the machine |
| SCN-TK-131 | deprecated | sut.helm refuses a cluster that is not a local kind cluster |
| SCN-TK-132 | implemented | sut.helm refuses a cluster that is not a local kind cluster |
| SCN-TK-133 | implemented | The scripted harness records each session's trace context |
| SCN-TK-134 | implemented | sut.compose takes down the project of a run that ended without taking it down |
| SCN-TK-135 | implemented | sut.http.output shows what every server of the scenario printed, the first one first |
| SCN-TK-136 | implemented | A scripted harness for sandboxes takes its script and sends its log over HTTP, with no folder of its script mounted |
| SCN-TK-137 | implemented | sut.helm uninstalls the scenario's releases when the scenario ends, with their objects outside its namespace |
| SCN-TK-138 | implemented | The fake inference adapter fails start with its message until the test makes it ready |
| SCN-TK-139 | deprecated | testkit timed runs the command, and with CI set it writes the runner's slowdown |
| SCN-TK-140 | deprecated | testkit timed without CI only runs the command |
| SCN-TK-141 | implemented | sut.acp hangs up, and a module that ends with its client exits |
| SCN-TK-142 | implemented | fakes.temporal and fakes.nats listen below the range of module ports |
| SCN-TK-143 | implemented | fakes.github lists the check runs that a test adds to a pull request's head commit, page by page |
| SCN-TK-144 | implemented | fakes.github refuses to list check runs to a token that may not read them |
| SCN-TK-145 | implemented | fakes.github removes a label from an issue |
| SCN-TK-146 | implemented | The fake inference adapter prints the same key for the same run of a gateway and revokes it |
| SCN-TK-147 | implemented | The fake inference adapter fails revoke with its message |
| SCN-TK-148 | implemented | sut.events adds a JetStream stream with a max age and reads the message a module published to it |
| SCN-TK-149 | implemented | fakes.traceStore answers Jaeger's query of a trace with the span it received by OTLP, and keeps none with "keep: false" |
| SCN-TK-150 | implemented | The fake sandbox's probe reports the denied host refused and removes its sandbox |
| SCN-TK-151 | implemented | The fake sandbox's probe reports the scripted outcome "reached" |
| SCN-TK-152 | implemented | fakes.postgres gives a later scenario the same PostgreSQL server and a database of its own |
| SCN-TK-153 | implemented | fakes.temporal gives a later scenario the same Temporal server and a namespace of its own |
| SCN-TK-154 | implemented | sut.pages reads a page by role, name and text |
| SCN-TK-155 | implemented | sut.pages sends a form, follows its redirect and keeps the cookies and the headers |
| SCN-TK-156 | implemented | A query that finds no element fails the test and names the role and the name it looked for |
| SCN-TK-157 | implemented | sut.browser opens a page in Chromium with the testkit's clock, one locale, one time zone and a named viewport |
| SCN-TK-158 | implemented | A request of the browser that leaves loopback fails the scenario and names the address |
| SCN-TK-159 | implemented | An error in the browser's console fails the scenario |
| SCN-TK-160 | implemented | A page with an accessibility violation fails the accessibility check |
| SCN-TK-161 | implemented | fakes.oidc signs in the person a test names with a signed ID token on the testkit's clock |
| SCN-TK-162 | implemented | fakes.oidc refuses a sign-in when the test named nobody |
| SCN-TK-163 | implemented | fakes.github signs in the person a test names with GitHub's OAuth flow and gives their primary email |
| SCN-TK-164 | implemented | sut.pages reads the theme that the server chose for a page |
| SCN-TK-165 | implemented | fakes.github answers the protection of a protected branch, and 404 for a branch without |
| SCN-TK-166 | implemented | fakes.github closes a pull request without merging and deletes its branch's ref |
| SCN-TK-167 | implemented | fakes.github writes one commit of several files with the Git Data API |
| SCN-TK-168 | implemented | fakes.github moves a branch back only when the update is forced |
| SCN-TK-169 | implemented | fakes.github merges a pull request with auto-merge once its required check passes |
| SCN-TK-170 | implemented | fakes.github refuses auto-merge where the repository does not allow it and for a pull request that can merge now |
| SCN-TK-171 | implemented | fakes.github answers the auto-merge request of a pull request whose auto-merge a module enabled |
| SCN-TK-172 | implemented | Enabling auto-merge twice in fakes.github fails the test with the pull request named |
| SCN-TK-173 | implemented | fakes.github lists the calls a module made, with their query |
| SCN-TK-174 | implemented | fakes.github keeps a blob's bytes and puts it into a tree by its SHA |
| SCN-TK-175 | implemented | fakes.github answers the rules of the rulesets that apply to a branch |
| SCN-TK-176 | implemented | sut.cli writes the text of stdin to the module's standard input and closes it |
| SCN-TK-177 | implemented | fakes.openbao gives the module OpenBao with a KV version 2 mount of the scenario and a token with a policy |
| SCN-TK-178 | implemented | A token of fakes.openbao has only its policy and lives as long as the test says |
| SCN-TK-179 | implemented | fakes.openbao gives a later scenario the same server and a mount of its own |
| SCN-TK-180 | implemented | fakes.openbao for containers answers a container at its container URL |
| SCN-TK-181 | implemented | sut.files.link makes a symbolic link that follows its target |
| SCN-TK-182 | implemented | fakes.personIssuer signs a proof on the testkit's clock that the key set it serves verifies |
| SCN-TK-183 | implemented | fakes.personIssuer with a name signs a proof whose claims and header the test changed |
| SCN-TK-184 | implemented | fakes.personProof reads a proof that a module sent, with whether a key set verifies it and its body matches |
| SCN-TK-185 | implemented | sut.site serves each file of a folder with its content type and the headers the test names |
| SCN-TK-186 | implemented | sut.site answers 404 for a path outside its folder and serves no folder outside the unit |
| SCN-TK-187 | implemented | A page that sut.browser opens during a mutation run runs the active mutant's branch of an instrumented script |
| SCN-TK-188 | implemented | A page that sut.browser opens without an active mutant runs the original branch of an instrumented script |
| SCN-TK-189 | implemented | A page that sut.browser opens with its clock paused runs its timers only when the test runs the clock |
| SCN-TK-190 | implemented | sut.files.put gives a file a mode and sut.files.mode reads it back |
| SCN-TK-191 | implemented | fakes.github lists the comments of a pull request's conversation page by page, 30 to a page by default |
| SCN-TK-196 | implemented | testkit timed runs the command and writes its wall time |
| SCN-TK-197 | implemented | testkit timed writes the wall time without the environment variable "CI" too |
| SCN-TK-198 | implemented | The fake sandbox's create and copy out of a sandbox take the time the options say |
| SCN-TK-199 | implemented | The fake sandbox's list with a label prints only the sandboxes whose spec has that label |
| SCN-TK-200 | implemented | The fake sandbox holds from its start the sandboxes that its option "held" names, and counts its IDs on after them |
| SCN-TK-201 | implemented | The test of an Outline runs once for each row, each in a workspace of its own, as one passed test case |
| SCN-TK-202 | implemented | One failed row fails the test case of the Outline and the failure names the row |
| SCN-TK-203 | implemented | A planned Outline whose rows all pass fails |
| SCN-TK-210 | implemented | Two scenarios with the same tag @shared use one start of the Compose project, which goes down when the run ends |
| SCN-TK-211 | implemented | When the shared start fails, each scenario of the group fails with the failure of the start, and the project goes down |
| SCN-TK-212 | implemented | A scenario without the tag @shared cannot use a shared start, and a scenario with the tag must use it |
| SCN-TK-213 | implemented | Two scenarios with the same tag @shared use one install of the chart in one namespace, which is deleted when the run ends |
