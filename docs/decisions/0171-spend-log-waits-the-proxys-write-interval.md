---
status: accepted
topic: ports
date: 2026-11-17
---

# 0171. spend-log waits the proxy's write interval, which an attached gateway's config names

## Context

`inference-litellm spend-log` reads LiteLLM's spend rows with `GET /spend/logs`. LiteLLM v1.106.2 does not write a
call's row when it answers the call: it queues the row, and a job writes the queue every
`proxy_batch_write_at + random.randint(0, 5)` seconds, the random part drawn once when the proxy starts
(`proxy_server.py`). `proxy_batch_write_at` comes from `general_settings` of the proxy's config, else from the
variable `PROXY_BATCH_WRITE_AT`, else 10. A queue monitor writes the queue too, every 2 to 30 seconds with a backoff
while the queue stays small, so rows often come sooner, but not always. LiteLLM has no call to write the queue now
or to tell its size (T-83).

A gateway that `start` runs has `proxy_batch_write_at: 1` in its config, so `spend-log` waited a fixed 8 seconds. A
proxy that a gateway attaches to (ADR 0080), such as the `litellm` service of the Compose profile, keeps LiteLLM's
default and writes every 10 to 15 seconds: the rows of the last calls could be missing from the spend log, and the
ledger would miss their spend (T-101).

Could the adapter read the attached proxy's interval? With the master key, v1.106.2 answers
`GET /config/field/info?field_name=proxy_batch_write_at` with 400 `Invalid field=proxy_batch_write_at passed in.`,
since the field is not in `ConfigGeneralSettings`; `GET /config/list?config_type=general_settings` lists only the
fields of that model; `/get/config/callbacks` and `/settings` return callbacks, alerts and router settings. No
endpoint returns the interval, the variable or the random part. Checked in the image's source and against a running
container.

## Decision

`spend-log` waits `proxy_batch_write_at + 5 + 2` seconds before it reads: the longest interval of the job, and two
seconds for the write. A gateway that `start` runs has the interval 1, so its wait stays 8 seconds. An attached
gateway takes the interval from `osf.proxy.proxy_batch_write_at` of the config that `start` attaches with, a number
of seconds above 0, else LiteLLM's default of 10, which waits 17 seconds; `start` keeps it in the gateway's record. A
value that is not such a number exits 2. A record written before this change has no interval and gets the default.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Read the interval from the proxy and wait for it | Always right, nothing to set | v1.106.2 has no endpoint that returns it; the random part is never visible |
| `attach` refuses a proxy whose interval the fixed wait does not cover | No longer wait | Needs the interval, which the adapter cannot read |
| A setting in `osf.proxy`, LiteLLM's default when absent (chosen) | Safe for the default and the Compose profile without a change; one place with the proxy's URL and key; a fast proxy can say so | The operator must name a longer interval than 10; a wrong value can still miss rows |
| An environment variable of the adapter | No config change | Every command must have it set, and two attached proxies cannot differ |
| Poll `/spend/logs` until the rows stop changing | Shorter for a busy proxy | Rows that are there say nothing about rows still in the queue (T-83) |

## Prior art

No new module, dependency or service. LiteLLM's own documentation names `proxy_batch_write_at` as the setting for how
often spend is written; no client library of LiteLLM's spend API waits for it.

## Consequences

The spend log of an attached gateway is complete for a proxy with LiteLLM's default, at the cost of 9 more seconds per
`spend-log`. An operator who sets a longer interval names it in `osf.proxy`; one with a shorter one may name it to
make `spend-log` faster. Revisit when LiteLLM can write its queue on request or report its interval.
