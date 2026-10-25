---
covers: [ports/channel/**]
---

# channel port

How the factory talks with people in their chat: a message that mentions the bot becomes a work item, the factory
replies in its thread, and it asks a person for an approval with a card. Decisions:
[ADR 0059](../../docs/decisions/0059-channel-port.md), and [ADR 0061](../../docs/decisions/0061-gatekeeper-ports.md)
for history, followed threads and times.

## The interface

A channel adapter is a program with these commands. Its client (intake, gatekeeper, a script, a test) runs them as
any command line. Every command but `history` prints one JSON line.

| Port operation | Command |
| --- | --- |
| receive | `<adapter> receive <delivery.json> [--thread <thread>]...` prints `{"kind": "work", "workItem"}`, `{"kind": "decision", "thread", "card", "choice", "time", "person"}`, `{"kind": "message", "thread", "id", "person", "time", "text"}` for a followed thread, or nothing |
| reply | `<adapter> reply <thread> <text>` prints `{"thread", "id", "time"}` |
| ask | `<adapter> ask <thread> <question> [--choice <name>]...` posts an approval card and prints `{"thread", "id", "time"}`; the choices are `approve` and `reject` when none is given |
| history | `<adapter> history <thread>` prints one line per message of the thread, oldest first: `{"id", "thread", "person", "time", "text", "mine"}` |

A thread is Vercel Chat SDK's thread ID, for example `slack:C0WEB:1767225600.000001` or `github:acme/web:12`. A
client keeps it as it is and passes it back to `reply`, `ask`, `history` and `receive --thread`. An adapter may also
take a channel as the target of `reply`, `ask` and `history` (the slack adapter takes `slack:<channel>`): a post there
starts a thread and prints it, and its history lists the messages that start threads. Times are RFC 3339 in UTC, with
as many fraction digits as the chat keeps.

Every adapter reads three variables:

| Variable | Meaning |
| --- | --- |
| `CHANNEL_API_URL` | The chat's API. Each adapter has the public service as its default. |
| `CHANNEL_TOKEN` | The bot's token. |
| `CHANNEL_SIGNING_SECRET` | The secret that signs the chat's deliveries, which `receive` checks. |

## What every adapter guarantees

- `receive` reads a delivery as a JSON file `{"headers": {...}, "body": "<the body as it arrived>"}`, written by the
  receiver from the HTTP request it got. A delivery whose signature does not match `CHANNEL_SIGNING_SECRET` exits 1
  and prints nothing.
- A person's message that mentions the bot prints a work item that `contracts/work-item` accepts:

  | Field | Value |
  | --- | --- |
  | `id` | `<thread>/<message ID>` |
  | `type` | `task` |
  | `title` | the first line of the text without the mention, at most 300 characters |
  | `description` | the text without the mention |
  | `requester` | `{"kind": "person", "id": "<adapter>:<user ID>", "displayName"}` |
  | `origin` | `{"source": "<adapter>", "url": "<link to the message>", "externalId": "<thread>"}` |
  | `dedupeKey` | the thread |

- A person's choice on a card that `ask` posted prints a decision: the thread, the card's ID, the choice and the
  person as `<adapter>:<user ID>`. A choice the card does not offer prints nothing.
- A person's message in a thread named with `--thread` prints a message line, and also its work item when it
  mentions the bot. The adapter keeps no list of followed threads; the client names them on each run.
- A message without a mention in a thread that is not followed, the bot's own message and any other delivery print
  nothing and exit 0.
- `history` marks the bot's own messages with `"mine": true`.
- A token the chat refuses exits 1 with `the channel refused the token`.

## Conformance

The shared behavior is the `@conformance` scenarios in [`features/`](features/channel.feature) (prefix
`SCN-CHANNEL`). Every adapter in `adapters/channel/<name>/` has one system test per scenario. The test chat is the
testkit's `fakes.slack` for `slack` and the conversation of a pull request in `fakes.github` for `github`. A community
adapter shows conformance with `testkit conformance <its copy of this features folder> --junit report.xml` against a
chat it brings.

## Adapters

| Adapter | Tier | What it calls |
| --- | --- | --- |
| [`slack`](../../adapters/channel/slack/README.md) | optional | Slack's Events API, interactivity and Web API through Vercel Chat SDK |
| [`github`](../../adapters/channel/github/README.md) | optional | GitHub's `issue_comment` webhooks and REST API through Vercel Chat SDK |
