---
status: accepted
topic: runs
date: 2026-11-16
---

# 0158. Sandboxes carry their owner and run, and the next foreman removes what a dead one left

## Context

A stage's sandbox is known only to the stage's activity: the foreman keeps its ID in memory and destroys it when the
stage ends (ADR 0068). When the foreman dies (SIGKILL, an out-of-memory kill, a lost node), its sandboxes stay: a
container, an egress proxy that holds the real tokens, and with the docker adapter one bridge network each. Docker's
default address pools end after about 30 such networks (measured on 16 November 2026: the 31st `docker network
create` failed with "all predefined address pools have been fully subnetted"), so a few crashes stop every sandbox on
the host. Temporal runs the stage again after its heartbeat timeout, and the new attempt creates a new sandbox
(ADR 0101), so nothing ever reads the old one again.

Two more holes: both adapters' `destroy` ignored the exit codes of Docker and kubectl and printed `destroyed <ID>`
also when nothing was removed, and a destroy that fails in the foreman is not tried again.

ADR 0090 solved the same problem for the inference gateways with labels and a sweep at the next start.

## Decision

- **Labels in the spec.** The sandbox spec gets an optional field `labels`, names and values that fit the label rules
  of Docker and Kubernetes both (an additive change of `contracts`). The docker adapter puts them on the sandbox's
  container, the kubernetes adapter on its SandboxClaim. `list --label <name>=<value>` lists only the sandboxes that
  carry the label (SCN-SANDBOX-031).
- **An owner of the foreman's own.** `FOREMAN_SANDBOX_OWNER` names the foreman on its platform. Set, every sandbox it
  creates carries `osf.owner=<owner>` and `osf.run=<run ID>` (SCN-FORE-187), and at its start, before its worker runs a
  stage, it destroys the sandboxes that `list --label osf.owner=<owner>` gives (SCN-FORE-188). A failed list or destroy
  is a warning; the next start tries again (SCN-FORE-189). The Compose profile sets the project's name, which Docker
  keeps unique on a host, and the chart `<release namespace>.<release name>` (SCN-DIST-058, SCN-DIST-059).
- **destroy tells the truth.** A part of a sandbox that is gone already is no failure; a part the platform does not
  remove is: `destroy` exits 1 with `the sandbox <ID> was not removed: ` and the platform's error (SCN-SANDBOX-032).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| An owner setting, labels and a sweep at the start (chosen) | Works after SIGKILL; no daemon; the profile and the chart name a unique owner for free | A leftover lives until the next start of that foreman; one foreman per owner |
| An owner the foreman makes once and keeps in `OSF_DATA` | Nothing to set | A scenario cannot know it without reading the data folder; a lost volume leaves the old owner's sandboxes for good |
| The owner from the Temporal namespace and task queue | Nothing to set | Two Compose projects on one host both run "default" and "foreman" and would remove each other's running sandboxes |
| Remove the sandbox of a stage when Temporal runs the stage again | Exact | The ID is in the memory of the process that died; it would have to be in the workflow's history, written before the sandbox exists |
| Small subnets from an address pool of the adapter's own | More than 30 sandboxes per host | `--subnet` needs a range no other network of the host uses and handling of collisions with every other client of the daemon; Docker's own `default-address-pools` does it better |

## Prior art

- **ADR 0090**: the inference gateways' owner label and the sweep at the next start, which this follows.
- **testcontainers Ryuk** (MIT): a reaper container that removes labelled objects when the client's connection ends;
  it would need its own container next to every foreman, and the Kubernetes sandboxes have no Docker.
- **Docker's `default-address-pools`** (daemon.json): the documented way to give a host more and smaller networks; the
  docker adapter's README names it for hosts that need more than about 30 sandboxes at once.

## Consequences

- A foreman that died leaves its sandboxes only until it starts again; a destroy that failed in a stage is retried
  there too.
- An adapter older than the field `labels` refuses a spec that has it: set `FOREMAN_SANDBOX_OWNER` only with
  sandbox-docker 0.9 or sandbox-kubernetes 0.7 or later. Without the setting the foreman sends no labels.
- Two foremen with the same owner remove each other's running sandboxes at their starts: the owner must be unique per
  Docker host or namespace, and one foreman runs per owner (the chart's Deployment has one replica and recreates it).
- A Docker host still holds about 30 sandboxes at once with Docker's default pools.
