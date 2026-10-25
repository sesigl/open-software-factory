---
status: accepted
date: 2026-10-24
---

# 0062. gatekeeper asks and reports through the channel and forge ports

## Context

TODO item T-15 ends with one slice: gatekeeper asks for approvals and posts its records through the channel and
forge ports (Vercel Chat SDK) in place of its direct Slack and forge calls (ADR 0047, ADR 0048, ADR 0059). ADR 0060
moved factory-spec onto the forge port and made a module run an adapter as a program named in a variable.

gatekeeper keeps no state of its own on the command line. `request` and `status` find the request message by its
marker, read the messages after it, and post what is new (ADR 0047). The server keeps its gates in PostgreSQL, takes
Slack's events and button presses, and reads the thread again on each event (ADR 0048). Today it calls Slack's Web
API (`auth.test`, `chat.postMessage`, `conversations.history`, `conversations.replies`) and the forge's REST API
(the pull request, its files, its comments, a new comment, a commit status) itself.

The ports cannot do all of that yet:

- The channel port has `receive`, `reply` and `ask` on a thread. It cannot start a new thread in a channel, and it
  cannot read the messages of a thread or a channel.
- The forge port's `pr` does not name the author, the labels, whether it is a draft, or the changed files, which a
  policy reads. It cannot list a pull request's comments.

## Decision

- **The channel port grows.** Every adapter passes the new `@conformance` scenario; the rest is per adapter.
  - `messages <thread>` prints one line per message of the thread, the first one included, oldest first:
    `{"id", "thread", "author", "time", "text", "mine"}`. `author` is `<adapter>:<user ID>`, `time` is ISO 8601 as
    precise as the chat keeps it (Slack: microseconds), `text` is the text as the chat holds it, and `mine` is true
    for the bot's own messages.
  - An adapter whose chat has channels also takes a channel, like `slack:C0GATES`. `messages <channel>` prints the
    newest 200 messages at the top of the channel, oldest first, each with its own thread. `reply <channel> <text>`
    and `ask <channel> <question>` start a new thread with the message and print that thread. channel-slack does
    this; channel-github's threads are pull requests and it has no channels.
  - channel-kit gets the command `messages`, an optional channel form, and a `post` that gives the thread it posted
    in.
- **The forge port grows.** Both adapters pass the new `@conformance` scenarios.
  - `pr` also prints `author` (`<adapter>:<login>`), `labels`, `draft` and `paths`, the first 100 changed files.
  - `comments <repo> <number>` prints one line per comment of the pull request's conversation, oldest first:
    `{"id", "url", "author", "time", "text", "mine"}`. `mine` is true for comments of the token's user.
  - `pr`, `comments` and `comment` on a pull request the repository does not have exit 1 with
    `no pull request <repo>#<number>`.
  - forge-github: a GitHub Actions token may not read `GET /user` (GitHub answers 403). Its user is then
    `github-actions[bot]`, which is who writes its comments, as gatekeeper assumed before.
- **gatekeeper runs the adapters as programs**, as factory-spec does (ADR 0060).
  - A `slack:` channel runs the adapter in `GATEKEEPER_SLACK_ADAPTER` (default `npx -y @opensoftware/channel-slack`)
    with `CHANNEL_API_URL`, `CHANNEL_TOKEN` and `CHANNEL_SIGNING_SECRET` from `GATEKEEPER_SLACK_URL`,
    `GATEKEEPER_SLACK_TOKEN` and `GATEKEEPER_SLACK_SIGNING_SECRET`. `request` finds an earlier request with
    `messages <channel>` and posts with `reply <channel>`; `status` reads `messages <thread>` and answers with
    `reply <thread>`. The server asks with `ask <channel> --choice Approve --choice Reject`, so the card keeps its buttons.
  - A pull request runs the adapter in `GATEKEEPER_FORGE_ADAPTER`, by default `npx -y @opensoftware/forge-github`
    for a pull request on github.com and `npx -y @opensoftware/forge-forgejo` for any other host, with `FORGE_URL`
    and `FORGE_TOKEN` from `GATEKEEPER_FORGE_URL` and `GATEKEEPER_FORGE_TOKEN`. `GATEKEEPER_FORGE_URL` is now the
    adapter's `FORGE_URL`: by default `https://api.github.com` for github.com and the pull request's origin for
    Forgejo, no longer `<origin>/api/v1`. gatekeeper reads `pr` and `comments`, posts with `comment` and sets its
    commit status with `check`. A person is the adapter's `author`, so the identities stay `github:<login>` and
    `forgejo:<login>`.
  - The server's Slack routes stay `/slack/events` and `/slack/actions`, so a Slack app needs no change. Each turns
    the request into a delivery file and runs `receive`, which checks Slack's signature: exit 1 is the answer 401. A
    decision is a press on the gate's card, found by its thread, at the server's time. Any other signed delivery
    makes the server check its pending gates in the channel again, because a reply like `reject <reason>` mentions
    no bot and `receive` prints nothing for it. The server still answers Slack's `url_verification` itself.
  - The server keeps a gate's thread as the port's thread ID, like `slack:C0GATES:1767225600.000001`.
- **The testkit follows.** `fakes.github` lists a pull request's changed files and its labels, answers `draft`, and
  has a second token like a GitHub Actions token, whose `GET /user` GitHub refuses. `fakes.forge` and `fakes.github`
  let `reviewer` comment on a pull request with `say`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Both ports grow what gatekeeper reads; gatekeeper runs the adapters | ISOLATION holds; any chat or forge with an adapter gates; the same shape as factory-spec (ADR 0060) | A process per call; the ports grow commands |
| gatekeeper keeps its own clients for Slack and forges | No change to the ports | Two Slack clients and three forge clients in the repository; the TODO item asks for the ports |
| `receive` prints every message in a thread of the bot | The server decides only the gate of that thread | `receive` must know who started a thread, which the SDK's memory state does not keep; SCN-CHANNEL-002 says a message without a mention prints nothing |
| Only buttons decide on the server | No re-check of the pending gates | A reason for a rejection needs a reply; SCN-GATE-048 decides a reply |
| `reply`, `ask` and `comment` print the message's time | No `messages` or `comments` call after a post | gatekeeper reads the time of its request that way anyway; the outputs stay as ADR 0057 and ADR 0059 wrote them |
| The decision's time from the chat | The exact time of a press | Slack's action time is not part of the port's decision; the server's clock is a minute or less away and is what decides expiry |

## Prior art

- The channel and forge ports and their adapters (ADR 0057 to ADR 0060) are this repository's own; this decision
  extends them.
- Vercel Chat SDK (`chat` 4.43, MIT, very active): `fetchMessages`, `fetchChannelMessages` and
  `channel(...).post` read threads and channels and start threads. Adopted already (ADR 0059); the adapters call them.
- go-scm (BSD-3-Clause, maintained) lists comments and changed files of a pull request over many forges; its shape is
  the model for `comments` and `paths`. Go only, not adopted (ADR 0009).
- Octokit (`@octokit/rest`, MIT, very active): GitHub only. Not adopted, as in ADR 0058.
- No new dependency: gatekeeper starts the adapters with `node:child_process`.

## Consequences

- gatekeeper has no Slack or forge client of its own. A chat or forge with an adapter that passes the ports'
  scenarios can hold its gates.
- Each call starts a process; `npx` needs the network on the first run. The GitHub Action installs the adapters
  through `npx` like gatekeeper itself.
- A Slack message in the gates' channel makes the server read the thread of each pending gate. A channel of gates
  is quiet, so this stays a few calls; revisit when a channel holds many pending gates.
- A press's time is the server's time, not Slack's: a press in the last minute before expiry counts when it reaches
  the server before the expiry.
- A gate that gatekeeper 0.2's server stored keeps Slack's `ts` as its thread, Slack's action time as a press's time
  and the button's action ID as its choice. On start, the server rewrites them to the port's thread ID, microseconds
  and the card's choice, so a gate left pending at the upgrade is still decided. No scenario covers this: a system
  test may not write the module's database, and no test can start gatekeeper 0.2.
- `GATEKEEPER_FORGE_URL` for Forgejo is the forge's origin now. A setup that named `<origin>/api/v1` changes it.
- The server answers Slack after `receive` has run, a process start of its own. Slack wants an answer within 3
  seconds; a slow host may see Slack retry a delivery, which decides nothing twice because a gate decides once.
- gatekeeper is the second module that runs adapters, which is when ADR 0060 said the spawning and parsing may move
  into a library. They stay in each module for now: the two differ in what they pass and how they report a failure,
  and DUP finds no clone. Move them when a third module runs adapters.
