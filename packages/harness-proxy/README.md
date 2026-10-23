---
covers: [packages/harness-proxy/src/**]
---

# harness-proxy

The ACP proxy that every harness adapter runs between its client and the coding agent behind it. It passes
sessions, prompts and updates on, refuses tool calls outside the allowlist without asking the client, stops an agent
that does not end a cancelled turn within 5 seconds, records every session, and exports a session as a run record.
A library: adapters depend on it, it has no command of its own. Decisions:
[ADR 0050](../../docs/decisions/0050-harness-port.md), [ADR 0052](../../docs/decisions/0052-harness-claude-code.md).

## Quick start

The `cli.ts` of an adapter names its harness, its usage and its agent, and hands the rest to the library:

```ts
import { runAdapter } from "@opensoftware/harness-proxy";

const code = await runAdapter({
  harness: "demo",
  usage: "Usage:\n  harness-demo run [--allow <kinds>]\n  harness-demo transcript <session ID>\n",
  agent: () => ({ command: "npx", args: ["demo-acp-agent"] }),
});
process.exit(code);
```

`harness-demo run --allow read,edit` then serves ACP on stdio with the agent behind the proxy, and
`harness-demo transcript <session ID>` writes `$OUTPUT/run-record.json` and `$OUTPUT/transcript.jsonl`.

## API

| Export | What it does |
| --- | --- |
| `runAdapter({ harness, usage, agent, newSession }, { args, env, streams, io })` | The command line of the adapter `harness-<harness>`. `run [--allow <kinds>] [-- <args>]` calls `agent(args, data)` for the agent to start (it may throw a usage error) and runs `serveProxy` on `streams` (default: stdio); `transcript <session ID>` runs `exportTranscript` into `OUTPUT` (default: the current folder). The data folder is `OSF_DATA`, default `.harness-<harness>`. The context defaults to the process's arguments and environment, and output and errors go to `io` (default: stdout and stderr). Gives the exit code: 0, 1 when the command failed, 2 for a usage error. |
| `serveProxy({ agent, allow, data, resource, newSession, io })` | Starts `agent` (`{ command, args, env }`) and speaks ACP to the client on `io` (default: stdin and stdout) and to the agent on its stdio. The promise resolves when the agent has exited. |
| `allowlistOf(text)` | The tool kinds of `--allow read,edit` as a list; `undefined` without the option. |
| `exportTranscript({ sessionId, data, output, harness })` | Writes the session's run record to `<output>/run-record.json` and its record to `<output>/transcript.jsonl`, and gives `{ recordFile, transcriptFile }`. A session the proxy never recorded is an error. |

How `serveProxy` behaves:

- **Sessions and prompts** pass through. A prompt sent while a turn runs is a steering message and reaches the
  agent at once. `newSession` changes each `session/new` request before the agent gets it, for example to set the
  product's permission mode.
- **The agent works in its folder itself.** The proxy offers it no client file system and no terminal.
- **The allowlist.** With `allow`, a permission request for a tool call of an ACP tool kind outside the list gets the
  agent's reject option from the proxy, and the client is never asked. A tool call without a kind is outside every
  list. Without `allow`, the client decides every tool call the agent asks about.
- **Cancel.** `session/cancel` goes to the agent. When the turn has not ended 3 seconds later, the proxy stops the
  agent and ends the turn with `cancelled`. A client that hangs up stops the agent.
- **The session record.** Every prompt, update, permission decision (`allowed`, `refused` or `refused by the
  allowlist`) and stop reason with its usage is one JSON line in `<data>/sessions/<session ID>.jsonl`, after a first
  line with the folder, the agent's name and version, and `resource` (default: `OTEL_RESOURCE_ATTRIBUTES` and
  `OTEL_SERVICE_NAME`).

The run record is a valid `run-record` (contracts): the session's resource with `service.name`
`harness-<harness>` unless the resource names one, `osf.harness.name` the adapter's harness name and
`osf.harness.version` the agent's version; `gen_ai.conversation.id` the session ID; `osf.outcome` from the last stop
reason (`end_turn` is `succeeded`, `cancelled` is `cancelled`, anything else is `failed`, and so is a session still
in a turn); the tokens of all turns the agent reported in `gen_ai.usage.*`; the last cost in USD of a `usage_update`
in `osf.cost.usd`; and `osf.transcript.uri` the `file:` URL of `transcript.jsonl`.

## Releases

release-please opens a release pull request from the Conventional Commits under `packages/harness-proxy/`. Merging
it creates the tag `harness-proxy-v<version>`. The workflow `.github/workflows/publish-harness-proxy.yml` then builds
`dist/` with `pnpm build` and publishes the package to npm. The first release is `0.1.0`; until `1.0.0`, a breaking
change raises the minor version. An adapter names the library with `workspace:*`; `pnpm pack` writes the released
version into the adapter's published `package.json`.

The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)):
the GitHub environment `npm`, a token only for the first version, then a trusted publisher for the workflow
`publish-harness-proxy.yml`. No credential is stored in the repository.

## Configuration

| Variable | Meaning |
| --- | --- |
| `OTEL_RESOURCE_ATTRIBUTES` | The resource attributes of the run as key=value pairs, when `serveProxy` gets no `resource`. |
| `OTEL_SERVICE_NAME` | The `service.name` of the resource, when `serveProxy` gets no `resource`. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-HPROXY-001 | implemented | serveProxy passes a prompt to the agent and its reply back to the client |
| SCN-HPROXY-002 | implemented | The allowlist refuses a tool call of another kind without asking the client |
| SCN-HPROXY-003 | implemented | Without an allowlist the client decides every tool call |
| SCN-HPROXY-004 | implemented | The hook of the adapter changes the session before the agent sees it |
| SCN-HPROXY-005 | implemented | An agent that ignores a cancel is stopped within 5 seconds |
| SCN-HPROXY-006 | implemented | A cancel the agent honors ends the turn at once |
| SCN-HPROXY-007 | implemented | exportTranscript writes the run record of a session with the harness name the adapter gives |
| SCN-HPROXY-008 | implemented | The run record of a cancelled session has the outcome "cancelled" |
| SCN-HPROXY-009 | implemented | The run record of a session the harness refused has the outcome "failed" |
| SCN-HPROXY-010 | implemented | The run record sums the tokens of the turns and takes the session's last cost |
| SCN-HPROXY-011 | implemented | The transcript has the decisions of the client and of the allowlist |
| SCN-HPROXY-012 | implemented | The transcript has a tool call the client refused |
| SCN-HPROXY-013 | implemented | The run record of a session that is still in a turn has the outcome "failed" |
| SCN-HPROXY-014 | implemented | runAdapter's "run" starts the agent the adapter names, with the allowlist of "--allow" |
| SCN-HPROXY-015 | implemented | runAdapter's "transcript" writes the session's run record to OUTPUT with the adapter's harness name |
| SCN-HPROXY-016 | implemented | runAdapter's "transcript" without a session ID is a usage error |
| SCN-HPROXY-017 | implemented | runAdapter prints the adapter's usage for "--help" |
