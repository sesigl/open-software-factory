---
status: accepted
date: 2026-11-14
---

# 0123. Cost and scores in the console, from the files of the improvement jobs

## Context

T-31 asks for the improvement path in the profile: scheduled jobs run runlog, scorekit, ledger and observer on the
factory's own runs, and the console shows cost and scores. Today only the weekly workflow of this repository
(`weekly-paid.yml`) runs scorekit and observer, on the committed `runs/`. The console reads the foremen, intake,
gatekeeper and the forge, but nothing of what the improvement path produces.

## Decision

The scheduled jobs write to one folder: run records as runlog writes them, and scores as `scorekit score` writes them.
Both are formats of `contracts/` (run-record and score). The console reads every `.json` and `.jsonl` file below
`CONSOLE_IMPROVE_DIR` when `/improvement` is opened and shows the total cost, each scorer's scored runs, passes, pass
rate and judge cost, and each stage of a run with its outcome and cost. It reads no report of ledger or scorekit,
because those reports are no contract, and it keeps no state.

The jobs, added later in T-31:

- In the Compose profile a service `improve` behind the profile `improve` loops with a sleep of `IMPROVE_INTERVAL`
  seconds (3600; 0 runs once). In the chart, with `improve.enabled`, one CronJob runs the same commands once per
  `improve.schedule`. One job, not one per command: each command reads what the one before wrote.
- The commands: copy each `transcripts/<session>/run-record.json` that the foreman wrote (ADR 0121) to
  `runs/<session>.json`; `scorekit score` for each scorer of `IMPROVE_SCORERS` (`improve.scorers`) into
  `scores/scores.jsonl`; `scorekit report`, `ledger report` and `observer analyze` into `reports/`. runlog runs no
  command of its own: the harness adapter's `transcript` already wrote each run record with runlog's format.
- Judging is a paid model call through litellm, so `IMPROVE_SCORERS` is empty by default and the job then judges no
  run. The other commands call no model.
- The console reads the same folder (`CONSOLE_IMPROVE_DIR`): the volume `improve` in Compose, the claim `osf-improve`
  in the chart. It skips the reports, which hold no run record or score. Both claims of the chart are ReadWriteOnce,
  so the job's pod and the console run on the foreman's node (pod affinity).
- The image is `observer:<version>` from the `module` stage of `deploy/images/Dockerfile`, with the released packages
  observer, scorekit and ledger, pinned as `osf profile-pins` writes them; `publish-images` builds it like every
  module image. No new stage and no new base image.
- A stage in a sandbox keeps its session record in the sandbox; the foreman runs the harness's `transcript` there and
  copies its folder out to `transcripts/<session>` before it destroys the sandbox (ADR 0121, amended), so the job sees
  the reference factory's stages too.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Read run and score records from a folder | Contract formats only; no new API; works for the profile volume, a chart PVC and this repository's `runs/` | Reads all files on each request; fine for the hundreds of runs of one factory, not for years of runs |
| Read `ledger report` and `scorekit report` JSON | Numbers already aggregated | Their formats are no contract, so the console would depend on two modules' internals (ISOLATION in spirit) |
| Query ledger's database | Fast, SQL | The console would need DuckDB or PostgreSQL and ledger's schema |
| Show Langfuse or Grafana only, through `CONSOLE_LINKS` | Nothing to build | The profile ships neither; the console would still show no cost |

## Prior art

Langfuse shows scores and cost per trace, and ledger writes a Grafana dashboard ([ledger](../../modules/ledger/README.md));
both stay available through `CONSOLE_LINKS`. For the scheduler of the jobs, supercronic (MIT, maintained) and a
Kubernetes CronJob were checked; a CronJob is native to the chart, and a shell loop needs no new image in Compose.
Nothing new is adopted for the page: it is one more Preact page of the console (ADR 0072).

## Consequences

The console shows cost and scores wherever a folder holds the records, including a checkout of this repository with
`CONSOLE_IMPROVE_DIR=runs`. When a factory's runs grow past what one request can read, the page should read ledger's
database or a trace store instead; revisit then.
