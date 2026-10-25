---
status: accepted
date: 2026-10-25
---

# 0061. gatekeeper asks and decides through the channel and forge ports

## Context

TODO item T-15 ends with one slice: gatekeeper asks for approvals and posts its records through the channel and forge
ports, in place of its own calls to Slack and the forge (ADR 0047, ADR 0048). factory-spec already runs the forge
port's adapters (ADR 0060).

gatekeeper keeps no state of its own on the command line: the channel holds the request and the decisions, and each
run reads them back (ADR 0047). The server keeps its gates in PostgreSQL and decides on Slack's events and button
presses (ADR 0048). To do that through the ports, gatekeeper needs more than the ports offer today:

| gatekeeper needs | Today it calls | The ports today |
| --- | --- | --- |
| Post a request as a new message in a Slack channel | `chat.postMessage` | `reply` and `ask` post only in a thread |
| Find its own request in the channel, read the replies of its thread | `conversations.history`, `conversations.replies` | no way to read messages |
| Know that a person replied in a gate's thread (server) | Slack's `message` event | `receive` prints nothing for a message without a mention |
| The time of a message, a reply or a press, to the microsecond | Slack's `ts` and `action_ts` | `reply`, `ask` and decisions print no time |
| Buttons labelled "Approve" and "Reject" | its own blocks | a card's choices are its button labels |
| The author, labels, draft flag and changed files of a pull request | the pulls and files API | `pr` prints none of these |
| Read the comments of a pull request, and know its own | the comments API and `GET /user` | `comment` only posts |

ADR 0060 said a library should run adapters once a second module runs them. gatekeeper is the second.

## Decision

- **The channel port grows three things.** Both channel adapters pass them as `@conformance` scenarios.
  - `history <thread>` prints one line per message of the thread, oldest first: `{"id", "thread", "person", "time",
    "text", "mine"}`. `person` is `<adapter>:<user ID>`, `time` is RFC 3339 in UTC with as many fraction digits as the chat
    keeps (Slack keeps microseconds), and `mine` is true for the bot's own messages. The SDK's `fetchMessages` reads
    them.
  - `receive <delivery.json> --thread <thread>...` follows the named threads: a person's message in one of them prints
    `{"kind": "message", "thread", "id", "person", "time", "text"}`. This is the SDK's subscription, with the client
    keeping the list instead of the SDK's state. Without `--thread`, receive prints what it printed before.
  - `reply`, `ask` and a decision also print `time`: of the posted message, or of the person's choice.
- **The slack adapter also posts to and reads a channel.** A target of `reply`, `ask` or `history` may be a channel,
  `slack:<channel>`: `reply` and `ask` start a new thread and print its thread ID, and `history` lists the channel's
  messages that start a thread (the SDK's `fetchChannelMessages`). Slack-only, so these are the slack adapter's own
  scenarios (`SCN-CSLACK`). A Slack card is the question as text above its buttons, so the message's text is the
  question as it was given.
- **The forge port grows two things.** Both forge adapters pass them as `@conformance` scenarios.
  - `pr` also prints `author` (`<adapter>:<login>`), `draft`, `labels` (their names) and `paths` (up to 100 changed
    files).
  - `comments <repo> <number>` prints one line per comment of the pull request's conversation, oldest first: `{"id",
    "person", "time", "text", "mine"}`, the channel port's history without `thread`. `mine` is true for the token's
    user. A GitHub Actions token may not read `GET /user`; then the token's user is `github-actions[bot]`.
  - `comment` also prints `time`.
- **`@opensoftware/cli` runs adapters.** `runAdapter({ name, command, env }, args)` runs the command line with the
  arguments and the environment and gives its JSON lines. An adapter that cannot start is named with the command; an
  adapter that fails is named with its message. factory-spec and gatekeeper use it.
- **gatekeeper runs the adapters as programs.**
  - A Slack channel goes through the program in `GATEKEEPER_SLACK_ADAPTER` (default `npx -y
    @opensoftware/channel-slack`). gatekeeper gives it `CHANNEL_API_URL` from `GATEKEEPER_SLACK_URL`,
    `CHANNEL_TOKEN` from `GATEKEEPER_SLACK_TOKEN` and `CHANNEL_SIGNING_SECRET` from `GATEKEEPER_SLACK_SIGNING_SECRET`,
    so the variables a user sets stay the same. The request is `reply` (command line) or `ask` with the choices
    `Approve` and `Reject` (server) to the channel. `find` and the thread are `history`.
  - A pull request goes through the program in `GATEKEEPER_GITHUB_ADAPTER` (default `npx -y
    @opensoftware/forge-github`) on github.com and `GATEKEEPER_FORGEJO_ADAPTER` (default `npx -y
    @opensoftware/forge-forgejo`) elsewhere, with `FORGE_URL` from `GATEKEEPER_FORGE_URL` and `FORGE_TOKEN` from
    `GATEKEEPER_FORGE_TOKEN`. The request is `pr`, the thread is `comments`, a post is `comment` and the commit status
    `gatekeeper` is `check`. A pull request stays on the forge port, not the channel port, because Forgejo has no
    channel adapter and the commit status is the forge's.
  - The server hands each request to `/slack/events` and `/slack/actions` to `receive` as a delivery file, with the
    threads of its pending gates as `--thread`. A delivery that `receive` refuses gets 401. A decision or a message in
    a gate's thread decides that gate, as before. Slack's `url_verification` gets its challenge back once `receive`
    accepted its signature.
  - gatekeeper has no Slack or forge client and no check of Slack's signature of its own. Messages, scenarios and
    records stay as they are.
  - The server's database keeps a gate's thread as the port's thread ID, such as `slack:C0GATES:1767225600.000001`.
    gatekeeper 0.2 kept Slack's `ts` alone, and the `ts` of a press; the server rewrites both to the port's thread ID
    and time when it starts, so a gate left pending is decided as before.
- **The testkit:** `fakes.github` lists the changed files of a pull request and answers its `draft` and `labels`, so
  both forge adapters and gatekeeper's tests run against it. gatekeeper's tests run the built adapters with
  `sut.adapter`, and its `turbo.json` builds them first.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Grow the ports and run the adapters | One Slack client and one forge client in the repository; gatekeeper works with any adapter that passes the scenarios | A process per call; more commands in two ports |
| Keep gatekeeper's own calls | Nothing to change | Two Slack clients and four forge clients; the TODO item asks for the ports |
| A pull request through the channel port's github adapter | The card and `/approve` already exist there | No Forgejo channel; the commit status is a forge call anyway |
| Keep the gates' state in the adapter (the SDK's state) | The SDK's usual subscriptions | The adapters keep no state between runs (ADR 0059); a second store next to gatekeeper's |
| Re-check every pending gate on any Slack event | No `--thread` | Every message in the channel reads every pending thread |
| A library only for running adapters | A smaller `@opensoftware/cli` | A library of one function; `@opensoftware/cli` already holds what command lines share |

## Prior art

- The channel and forge ports and their adapters (ADR 0057 to ADR 0060) are this repository's own; this decision
  extends them.
- Vercel Chat SDK (`chat` 4.43, MIT, Vercel, very active): `fetchMessages`, `fetchChannelMessages`,
  `postChannelMessage` and thread subscriptions give history, new threads and followed threads. Adopted as before.
- execa (MIT, maintained) and zx (Apache-2.0, Google, maintained) run programs with nicer errors. Checked, not adopted:
  `node:child_process` with ten lines is enough, as in ADR 0060.
- Slack Bolt and Octokit (MIT, maintained): checked again for history and comments; not adopted, as in ADR 0048 and
  ADR 0058.
- No new dependency.

## Consequences

- gatekeeper works with any chat and any forge whose adapter passes the ports' scenarios; a new chat needs gatekeeper
  to know its channel form.
- Each gatekeeper command starts a few adapter processes; the server starts one per Slack request. Slack's 3-second
  limit holds with an installed adapter; `npx` is slower on its first run.
- The gatekeeper action needs the adapters through `npx`, which needs the network on its first run, as the action
  already needs for gatekeeper itself.
- T-15 is done: the forge and channel ports and their adapters pass conformance, and factory-spec and gatekeeper use
  them.
- Revisit when a chat has no threads, or when one Slack request needs more than one adapter call.
