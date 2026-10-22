---
status: accepted
date: 2026-10-22
---

# 0047. gatekeeper asks people for approval by a Rego policy and writes signed approval records

## Context

TODO item T-11 asks for gatekeeper: rule-based human approvals for any automation or CI job. The vision asks that
work waits at a human gate until a person approves (SCN-FACTORY-ORCH-003), that a person reviews the specification
(LOOP-005) and the product (LOOP-010), that a factory change cannot merge without a person's approval
(IMPROVE-003), and that only authorized roles change a factory (RUNTIME-009). The engineering principle "Humans at
the gates" says: gate policy as code by risk class, and no merge without a signed approval record.

The factory definition already names a gate's policy as a path to a Rego file (`stages[].gate.policy`) and its
approver groups. The contracts define the events `gate.requested@v1` and `gate.decided@v1`. observer marks its pull
requests that change protected paths with `[needs human]` and leaves the enforcement to gatekeeper (ADR 0046). The
channel port (T-15) and the HTTP API do not exist yet.

This change is the first slice of T-11: the CLI `request`, `status` and `verify`, Slack and pull request comments as
channels, signed records, the events, and the GitHub Action with its dogfood on this repository.

## Decision

- **New core module `modules/gatekeeper`** (TypeScript, prefix `SCN-GATE`), published as
  `@opensoftware/gatekeeper`. Layers: `entry` (`src/cli.ts`) → `commands` → `adapters` → `domain`. `domain` checks
  the request and the policy's answer, derives the gate ID, decides the gate's state from the messages of its thread,
  writes the message texts, and signs and verifies records, without I/O; `adapters` run OPA, call Slack and the forge
  API, publish to NATS and read and write files; `commands` join them.
- **A request** is a JSON file: `workItem`, `stage`, `summary`, optional `links` and `change`. `change` holds any
  facts the policy needs, such as changed paths or labels. `--pull-request <URL>` builds the request from a pull
  request instead: the work item is the pull request's URL, the stage is `merge`, and `change` holds the
  repository, number, author, head branch and commit, base branch, labels and changed paths.
- **The policy is Rego, evaluated by OPA.** gatekeeper runs `opa eval` (OPA 1.x, `GATEKEEPER_OPA`, default `opa`) as a
  separate process with the request as `input` and reads `data.gatekeeper`: `approvers` (the groups that may decide;
  an empty set approves without a person), optional `risk`, optional `escalate_after` with `escalate_to`, and
  optional `expire_after`. Durations are like `30m`, `4h` or `2d`. The pinned `opa` 1.21.0 is part of `make install`.
- **Groups** are a JSON file that maps each group to its members: identities like `slack:U024BE7LH` or
  `github:octocat`. A group the policy names must exist in it.
- **The gate ID** is `g` and the first 16 hex digits of the SHA-256 of the canonical JSON of `workItem`, `stage` and
  `change`. The same request is the same gate. A new commit on a pull request is a new gate, so an approval of an
  older commit does not count.
- **The channel is the store.** gatekeeper keeps no state between commands. `request` posts the approval request to
  the channel unless the gate's request is there already. `status` takes the same arguments, reads the policy and
  the thread again and decides. Each message of gatekeeper ends with a marker such as `[gatekeeper g… requested]`
  (an HTML comment on a forge); only markers by gatekeeper's own user count (Slack `auth.test`, forge `GET /user`, or
  `github-actions[bot]` for a GitHub Actions token).
  - `--channel slack:<channel ID>`: the request is a message; a decision is a reply in its thread, `approve` or
    `reject <reason>`. Slack Web API at `GATEKEEPER_SLACK_URL` with `GATEKEEPER_SLACK_TOKEN`.
  - `--pull-request <URL>` without `--channel`: the request is a comment on the pull request; a decision is a later
    comment `/approve` or `/reject <reason>`. `status` also sets the commit status `gatekeeper` on the head commit:
    `pending`, `success` or `failure`. GitHub and Forgejo answer the same calls; the API base is
    `https://api.github.com` for github.com and `<origin>/api/v1` otherwise, `GATEKEEPER_FORGE_URL` overrides it.
- **Decision rules.** The first decision in the thread by a member of an approver group decides. A decision by
  anyone else is refused with a reply, once. When `escalate_after` has passed, `status` posts one message that asks
  the groups of `escalate_to`; their members may decide after that message. When `expire_after` has passed without a
  decision, the gate expires. `status` exits 0 when approved, 1 when rejected or expired, and 3 while it waits.
- **The record** (`$OUTPUT/record.json`, or `--record`) names the gate, the work item, the stage, the SHA-256 of the
  request, the policy and the SHA-256 of its text, the risk, the approver groups, the channel, the request time, the
  decision, who decided (absent when the gate expired) and when. With `GATEKEEPER_SIGNING_KEY` (an Ed25519 private
  key in PEM) it carries an Ed25519 signature over its canonical JSON and the SHA-256 of the public key.
  `gatekeeper verify --public-key <file> <record.json>` checks it. Without the key the record is unsigned and `verify`
  refuses it.
- **Events.** With `GATEKEEPER_NATS_URL`, `request` publishes `gate.requested@v1` on `osf.gate.requested.v1` when it
  posts a request, and `status` publishes `gate.decided@v1` on `osf.gate.decided.v1` when it posts the decision. The
  events are plain NATS messages; a JetStream stream on `osf.>` keeps them. The Postgres outbox (ADR 0003) comes
  with server mode.
- **GitHub Action.** `modules/gatekeeper/action.yml` sets up OPA, takes the pull request of the event
  (`pull_request` or a comment on a pull request), runs `request` and `status` and writes the record as the artifact
  `gatekeeper-record`. It fails when the gate is rejected or expired; while the gate waits, the commit status
  `gatekeeper` is `pending`. A branch protection rule that requires the status `gatekeeper` blocks the merge until a
  person approves.
- **Dogfood.** `.github/workflows/gatekeeper.yml` runs the action on every pull request of this repository with the
  policy and the groups of `.github/gatekeeper/`, read from the default branch so a pull request cannot change its
  own gate. Factory-made pull requests (branches `observer/` and `factory/`, or the label `factory`) need a member of
  `maintainers`; other pull requests are approved by the policy without a person.
- **Testkit.** fake Slack answers `auth.test` with its bot user (`SCN-TK-051`).
- **Release.** release-please with the tag `gatekeeper-v<version>`, first version `0.1.0`, and
  `.github/workflows/publish-gatekeeper.yml`, like observer (ADR 0046).
- **Later slices of T-11:** the HTTP API with its OpenAPI in `contracts/` (`gatekeeper serve`, Slack's Events API and
  buttons instead of polling), and the channel port (T-15) with Vercel Chat SDK in place of the Slack and forge
  calls here.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| OPA and Rego | The factory definition, the event fixtures and observer already name Rego; returns data such as groups, not only allow or deny; CNCF graduated | A Go binary next to Node |
| Cedar (`@cedar-policy/cedar-wasm`) | Runs in process as Wasm; analyzable | Answers allow or deny only; picking groups needs one call per group; the contracts would change |
| OPA compiled to Wasm (`@open-policy-agent/opa-wasm`) | In process | Needs `opa build` first anyway; the npm package was last released in 2024 |
| Our own YAML rules | No dependency | A second policy language to learn and to secure |
| The channel as the store | Works in CI, where nothing persists between jobs; one place to audit | Each `status` reads the thread again |
| A database or a state folder | Fast lookups | Lost in CI between runs; a second truth next to the thread |
| Ed25519 signatures (`node:crypto`) | Small, deterministic, no dependency; anyone with the public key verifies | Key handling is the user's job |
| Sigstore or in-toto attestations | Keyless, standard | Needs network and an OIDC identity; heavy for a CLI record |
| Reply text and comments as decisions | Works with the fake and every forge; no app setup | Buttons are nicer in Slack; they come with the channel port |

## Prior art

- trstringer/manual-approval (MIT, GitHub Action, maintained): opens an issue and waits for approvers' comments
  "approve" in the job. Not adopted: it blocks a runner while it waits, it knows only GitHub users and has no policy or
  record. Its comment words shaped `/approve` and `/reject`.
- GitHub environments with required reviewers and branch protection reviews (GitHub, built in): approvals per
  deployment or pull request. Not adopted as the gate: no policy by risk class, no Slack, and the author can never
  approve their own pull request (ADR 0013). gatekeeper's commit status works with branch protection.
- HumanLayer (`humanlayer`, `@humanlayer/sdk`, Apache-2.0, last npm release January 2026): approvals for agent tool
  calls in Slack and e-mail through the hosted HumanLayer service. Not adopted: it needs the paid hosted service, and
  the project moved to its CodeLayer IDE.
- Vercel Chat SDK (`chat`, MIT, very active): one bot API for Slack, Teams, Discord and more, with cards and
  buttons. Not adopted in this slice: it needs a webhook server and more Slack calls than the fake answers. The
  channel port (T-15) adopts it.
- Open Policy Agent (Apache-2.0, CNCF graduated, active, 1.21.0 of September 2026): adopted as the policy engine
  through its CLI. Cedar (Apache-2.0, active) was checked; see the options.
- Atlantis and Spacelift approvals (Apache-2.0 and commercial): approvals of infrastructure plans in pull requests,
  tied to Terraform. Not adopted.

## Consequences

- Any job asks people for approval with two commands and gets a signed record. A pull request gets a commit status
  that branch protection can require.
- Factory-made pull requests of this repository need a maintainer's `/approve` once the status `gatekeeper` is
  required on `main`; that rule is a repository setting.
- `status` polls. A long wait means repeated runs; the HTTP API with Slack events removes the polling.
- A Slack thread or a pull request thread holds the truth. Deleting it loses the gate; the record stays.
- Revisit the decision words when the channel port brings buttons, and the store when server mode needs a history
  of gates.
