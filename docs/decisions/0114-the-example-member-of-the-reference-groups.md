---
status: accepted
date: 2026-11-13
---

# 0114. The example member of the reference groups

## Context

The reference `groups.json` of the Compose profile and the Helm chart named `slack:U0ADA` as the only member of
`maintainers`. That ID looks real but belongs to nobody, so a first factory asked its first gate of nobody and waited
until the gate expired, without a word why (T-47). The same ID is used as a real person in gatekeeper's scenarios, so
neither module could tell the example from a person.

## Decision

- The reference `groups.json` (`deploy/compose/factory/`, which the chart's `files/factory/` links) names the example
  member `slack:U0EXAMPLE`. "The example's members" means exactly this one identity: it stands for a person and is
  nobody. Other files keep their own IDs.
- `gatekeeper serve` writes one line to stderr for each group whose members are all `slack:U0EXAMPLE` (an empty
  group too), and starts all the same: a group without people is a setup mistake, not a reason to stop the gates of
  the other groups.
- `console doctor` and `/health` have the check `groups` when `CONSOLE_GROUPS` names the groups file. It fails on such
  a group with the file to fix. The Compose profile and the chart set `CONSOLE_GROUPS` to `/factory/groups.json`.
- Both modules hold the identity as a constant of their own (ISOLATION); a change of it changes both and this ADR.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A fixed example identity, checked by both modules | Deterministic, needs no Slack call, works offline | Does not catch a real-looking ID that is wrong |
| Ask Slack's `users.info` for each member | Catches every unknown ID | A Slack call in doctor; nothing for `github:` members; needs the bot token in the console |
| Fail gatekeeper's start or its `/v1/health` | Loud | The profile waits on gatekeeper's health, so the quick start would hang instead of telling |
| Ship an empty group | Nothing fake | gatekeeper's policy would be valid but nobody decides, with nothing to search for |

## Prior art

Placeholder values that a doctor command flags are common (`example.com` in RFC 2606, `changeme` checks in Helm charts
such as Bitnami's). No library is needed for one string comparison.

## Consequences

A person who runs the quick start sees `FAIL  groups` until they put their own ID in `groups.json`. A Slack ID that is
real-looking but wrong still passes; a check against Slack can follow when the console gets a Slack token.
