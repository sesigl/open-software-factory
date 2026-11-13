---
status: accepted
date: 2026-11-13
---

# 0108. One key and one budget per run

## Context

The foreman kept each run's key of the gateway in memory (`keys` in `modules/foreman/src/workflows/activities.ts`).
After a restart it asked the port for a new key, so the run's budget started again from zero; a run could spend its
budget once per restart. A run's key also lived until the gateway stopped, long after the run ended. Two more causes
made a restart lose the key even if the port gave it again: the foreman stopped its gateway at every shutdown, and
`stop` of a gateway removes all its keys and their spend (ADR 0056), also for a gateway attached to a running proxy.

## Decision

- **The same key for the same run.** The port's `key <ID> <run ID>` prints the same key every time for the same run of
  the same gateway, with the spend it has. A budget counts once per run, not once per `key` call; the budget of the
  first call stays. inference-litellm makes the key's value itself: `sk-osf-run-` and an HMAC-SHA256 of the gateway's
  ID and the run's ID under the gateway's master key, so no key value is stored anywhere. It looks the key up with
  LiteLLM's `GET /key/info?key=`; only when LiteLLM answers 404 does it make the key with `/key/generate`, passing that
  value as `key` and `osf-run-<ID>-<run ID>` as `key_alias`, which LiteLLM keeps unique.
- **A new port command `revoke <ID> <run ID>`.** It deletes the run's key with `/key/delete`; a call with the key then
  gets 401. A run without a key, or one already revoked, is no error (exit 0), so a revoke can run again. The spend
  rows of the key stay in the spend log. `stop` of an attached gateway deletes the keys that are left and takes a
  404 for a key that is already gone.
- **The foreman revokes the run's key when the run ended.** `publishCompleted` runs for every end, completed, failed
  or cancelled, and revokes the key after it published `run.completed@v1`. The workflow does not change, so no
  history of an older run replays differently. A revoke that fails is a warning and never fails the run; the key
  then lives until the gateway stops, as before.
- **The gateway outlives a restart while a run has a key.** The foreman keeps its gateway's ID and URL in
  `OSF_DATA/inference/gateway.json` and a file per run with a key that is not revoked in
  `OSF_DATA/inference/runs/`. At its start it takes the gateway of that file when `list` still prints its ID, and
  starts one otherwise. At its stop it stops the gateway only when no run has a key; else it leaves the gateway
  running for the foreman that comes next. Together with the same key, the run keeps its key and its spend across a
  restart.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The same key by a value the adapter derives, looked up with `/key/info` (chosen) | LiteLLM keeps the spend and enforces the budget as before; no secret stored; one call more per `key` | The value depends on the master key: a proxy whose master key changes gives a run a new key |
| The same key by `key_alias`, found with `/key/list?key_alias=` | LiteLLM's own lookup | LiteLLM gives only the hashed token after `/key/generate`; the key's value cannot be read again, so it would have to be stored |
| The budget on the run: a LiteLLM team or end user per run with `max_budget`, a new key per restart in it | Keys may change, the budget stays | A team per run is more state to clean up; a `customer` budget needs the harness to send `user` on every call, which Claude Code and Codex do not |
| The budget on the run in the foreman: pass `budget - spent` to a new key | No gateway feature needed | The foreman must read the spend before every restart; a killed foreman cannot |
| A key with `duration` (LiteLLM's expiry) instead of a revoke | No call at the end | A run's length is not known; a long run's key would expire while it runs |
| `/key/block` instead of `/key/delete` | The key can be unblocked | A run that ended never needs its key again; a blocked key stays in the table |

## Prior art

- **LiteLLM proxy** (MIT, active, image `v1.106.2` that the adapter pins): virtual keys with `key`, `key_alias`,
  `max_budget`, `duration`; `GET /key/info`, `/key/delete` with `keys` or `key_aliases`, `/key/block`; budgets on
  keys, teams (`/team/new`) and end users (`/customer/new`). Checked by hand on the pinned image: `/key/generate`
  takes a value of our own for `key`; a second key with the same `key_alias` gets 400 ("Unique key aliases across
  all keys are required"); `/key/info` answers 404 `not_found_error` for an unknown key; `/key/delete` answers 404
  for a key that is gone; a deleted key's call gets 401 `token_not_found_in_db`. We adopt these features and build
  no key store.
- **Temporal** (MIT): the workflow's history replays; a new activity in the workflow would need `patched`. The revoke
  goes into the activity `publishCompleted` instead.

## Consequences

- A run spends at most its budget across restarts of the foreman, as long as the gateway lives; its key stops
  working once the run ended.
- A gateway that the foreman leaves for the next foreman still has the owner label of the foreman that started it
  (ADR 0090). A `start` of another launcher on the same host removes it after `OSF_INFERENCE_ORPHAN_AGE` seconds,
  and its runs get new keys from a new gateway. The profile's gateway attaches to its proxy and has no such label.
  Revisit when a host runs more than one launcher.
- A third-party adapter implements `revoke`; the conformance scenarios SCN-INFER-014 and -015 show it.
