---
status: accepted
date: 2026-10-24
---

# 0059. The channel port is a command line on Vercel Chat SDK, with slack and github channels

## Context

TODO item T-15 asks for a channel port: receive a message as a work item, reply in its thread with a message or a
card, and ask a person for an approval and get the decision back. Its first channels are Slack and GitHub, through
Vercel Chat SDK. The vision asks that work arrives from every surface people use (SCN-FACTORY-ACCESS-001) and that the
factory works with the company's own chat (SCN-FACTORY-OPEN-005).

Today gatekeeper calls Slack's Web API on its own (ADR 0047, ADR 0048), and nothing turns a chat message into a work
item. Modules may not import adapters (ISOLATION), so intake and gatekeeper need a channel they can run, as for the
forge, sandbox and inference ports (ADR 0054, ADR 0056, ADR 0057). The testkit already has `fakes.slack` (ADR 0048)
and `fakes.github` (ADR 0058).

## Decision

- **The port is a command line.** A channel adapter is a program with these commands. Their shared behavior is the
  `@conformance` scenarios in `ports/channel/features/` (prefix `SCN-CHANNEL`). Every command prints one JSON line.
  - `receive <delivery.json>` reads one webhook delivery of the chat and prints what it means:
    - a message that mentions the bot: `{"kind": "work", "workItem": {...}}`. The work item follows
      `contracts/work-item`: its `id` is `<thread>/<message>`, its `type` is `task`, its `title` is the message's
      first line without the mention (at most 300 characters) and its `description` the whole text without it. The
      `requester` is the person, `<channel>:<user ID>` with their display name. The `origin` has the channel as
      `source`, a link to the message as `url` and the thread as `externalId`. The `dedupeKey` is the thread.
    - a person's choice on an approval card: `{"kind": "decision", "thread", "card", "choice", "person"}`.
    - nothing for any other delivery: a message without a mention, the bot's own message, another event.
  - `reply <thread> <text>` posts the text in the thread and prints `{"thread", "id"}`.
  - `ask <thread> <question> [--choice <name>]...` posts an approval card with the question and its choices
    (`approve` and `reject` when none is given) and prints `{"thread", "id"}`. The card's ID is the `card` of the
    decision.
- **A thread is Vercel Chat SDK's thread ID**: `slack:<channel>:<thread ts>` or `github:<owner>/<repo>:<number>`. It
  names the chat, so a client keeps it as it is.
- **A delivery is a JSON file** `{"headers": {...}, "body": "<the body as it arrived>"}`, as for the forge port, so the
  adapter checks the signature against the body's bytes. A delivery whose signature does not match exits 1 and
  prints nothing.
- **Every adapter reads three variables:** `CHANNEL_API_URL` (the chat's API, with a default for the public service),
  `CHANNEL_TOKEN` (the bot's token) and `CHANNEL_SIGNING_SECRET` (the secret that signs deliveries). A token the chat
  refuses exits 1 with `the channel refused the token`.
- **Vercel Chat SDK is adopted** (`chat`, `@chat-adapter/slack`, `@chat-adapter/github`, with
  `@chat-adapter/state-memory`). Each command builds a `Chat` with one adapter and memory state, so the program keeps
  no state between runs. `receive` turns the delivery into a `Request` and hands it to the SDK's webhook handler; its
  `onNewMention` and `onAction` handlers give the work item and the decision. `reply` and `ask` post through the SDK's
  thread. A card is the SDK's `Card` with one button per choice.
- **The first adapters are `adapters/channel/slack`** (`@opensoftware/channel-slack`) **and
  `adapters/channel/github`** (`@opensoftware/channel-github`), both optional.
  - slack: a delivery is an Events API callback or an interactivity payload. The adapter checks Slack's `v0`
    signature itself with `CHANNEL_SIGNING_SECRET` and refuses a request older than 5 minutes, with the time from
    `OSF_NOW` or the clock, and passes the SDK a verifier that accepts what it checked. A decision is a press of a
    card's button. The work item's link is `chat.getPermalink`, and the person's name comes from `users.info`.
  - github: a thread is the conversation of a pull request; a delivery is an `issue_comment` event signed with
    `X-Hub-Signature-256`. The bot is the token's user (`GET /user`), and a mention is `@<login>`. GitHub has no
    buttons, so the card asks for an answer such as `/approve`. A comment that is exactly `/<choice>` is a decision
    for the newest card of the bot in the thread that offers that choice; a comment that names no choice of a card
    prints nothing. The person is `github:<login>`.
- **The testkit** follows the SDK's calls: `fakes.slack` answers `users.info` and `chat.getPermalink`, and
  `fakes.github` answers `GET /user`, lists a pull request's comments and lets a person comment with `say`, which
  delivers the `issue_comment` event.
- **Later slice of T-15:** factory-spec's webhooks and gatekeeper's approvals and records through the forge and
  channel ports. The `teams` and `linear` channels follow the same scenarios.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A command line per channel on Vercel Chat SDK | Same shape as the other ports; ISOLATION holds; the SDK knows each chat's events, mentions, threads and cards | A process per message; the SDK's state does not live across runs |
| A long-running bot server per channel | The SDK's usual shape; subscriptions and state | A second server next to intake; its own state and outbox; harder to test from outside |
| Direct calls to each chat's API, as gatekeeper does | No dependency | Every chat's events, signatures, mentions and cards by hand; the TODO item names the SDK |
| A decision as a text reply on Slack too | One rule for both chats | Slack has buttons that name the person and the card; gatekeeper already uses them (ADR 0048) |
| The decision in a new contract | A typed format | It is the port's output, like the forge port's JSON lines; the work item is already a contract |

## Prior art

- Vercel Chat SDK (`chat` 4.43, `@chat-adapter/slack`, `@chat-adapter/github`, `@chat-adapter/state-memory`, MIT,
  Vercel, very active, weekly releases in October 2026): one bot API over Slack, Teams, Google Chat, Discord, GitHub,
  Linear and more, with mentions, threads, cards, buttons and webhook verification. Adopted. Its Slack adapter takes
  an API URL and a webhook verifier; its GitHub adapter takes an API URL, a token and a webhook secret, which the
  testkit's fakes need.
- Slack Bolt (`@slack/bolt`, MIT, Slack, active): Slack only, with its own receiver. Checked in ADR 0048, not adopted.
- Octokit webhooks (`@octokit/webhooks`, MIT, GitHub, very active): GitHub only. The SDK's GitHub adapter uses Octokit
  inside.
- vercel-labs/emulate (Apache-2.0, very active): stateful Slack and GitHub emulators. Checked again: its Slack has no
  signed interactivity payloads and its GitHub no commit statuses (ADR 0058), so the testkit keeps its own fakes.
- Botkit and Errbot (MIT and GPL-3.0, little activity): older multi-chat bot frameworks. Not adopted: unmaintained or
  Python.

## Consequences

- intake turns a mention in any channel into a `work.received` event with `receive`, and gatekeeper asks for an
  approval with `ask` and reads the decision from `receive`, whatever the chat.
- A program with no state per message is easy to test, but a delivery that needs the thread's history (a GitHub
  decision) costs one more call.
- Slack's `url_verification` and the 3-second answer stay with the receiver, which answers Slack before it runs
  `receive`.
- A community channel (Discord, Google Chat) is any program that passes `ports/channel/features/` with `testkit
  conformance` against a chat it brings; most are a Chat SDK adapter and a few lines.
- Revisit when a channel needs state across messages (subscriptions, modals), or when the SDK changes its thread IDs.
