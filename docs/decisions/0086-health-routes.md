---
status: accepted
date: 2026-11-08
---

# 0086. Health routes that check what a server needs

## Context

The Compose profile marks a module healthy when its API answers any status below 500 (`x-module` in
`deploy/compose/compose.yaml`). A foreman whose Temporal is gone, or an intake whose database refuses connections,
still answers 401 to a request without a token, so it counts as healthy. To find the cause, a person must read the
logs of each service. The review of the whole stack marked this as a P0 gap for v1 (`TODO.md` T-25): a team needs one
place that says what is wrong and how to fix it.

## Decision

- **`GET /v1/health`** on `intake serve`, `gatekeeper serve` and `foreman serve` answers the model `Health` of
  `contracts/`: `status` (`ok` or `failing`) and `checks`, one per system the server needs, each with `name`, `ok` and,
  when it fails, a `detail` that says what failed and what to do. It answers 200 when every check is ok, else 503.
- **No token.** Docker's health check and a load balancer call it without credentials. The answer holds no secret, no
  URL with a password and no data of a work item, gate or run.
- **The checks:**

  | Server | Checks |
  | --- | --- |
  | intake | `database` (a query), `nats` with `INTAKE_NATS_URL` (a round trip to NATS) |
  | gatekeeper | `database` (a query), `opa` (the program runs), `nats` with `GATEKEEPER_NATS_URL` (a connection) |
  | foreman | `temporal` (the frontend answers), `nats` with `FOREMAN_NATS_URL` (a round trip to NATS) |

- **Each check has a time limit** of 2 seconds, so a hung dependency makes the answer `failing`, not slow.
- **One path in `contracts/`.** The three servers share the operation `HealthApi.getHealth`, because they answer the
  same model. A new path and new models are not breaking: contracts get a minor version.
- **The profile uses it** once the released images have it: `OSF_HEALTH_PATH: /v1/health`, and the health check wants
  a 2xx answer. `console doctor` and the console's health page read these routes (a later slice of T-25).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A health route per server with dependency checks (chosen) | One answer per server; Docker, Kubernetes and the console read the same route | Each server needs a few lines per check |
| Keep "any status below 500" | Nothing to build | A server with a dead dependency counts as healthy |
| Only `console doctor` probes each dependency itself | One place | The console would need the database URLs and NATS of every server |
| Kubernetes-style `/livez` and `/readyz` | Known split | One route is enough for Compose; the Helm chart can use the same route for both probes |

## Prior art

- **Health check response format for HTTP APIs** (IETF draft `draft-inadarei-api-health-check`, expired): `status`
  and `checks`. We take its idea, with a smaller model, because the draft did not become a standard.
- **Spring Boot Actuator `/actuator/health`** and **Kubernetes probes**: an aggregated status with one entry per
  dependency; the same shape.
- **`@fastify/under-pressure`** (MIT, maintained): checks event-loop delay and memory, not dependencies. Not adopted:
  the servers need dependency checks, which it leaves to a callback; the callback is the whole of our code.

## Consequences

- A container whose dependency fails becomes unhealthy, and `docker compose ps` shows which one.
- A dependency that is down for a short time makes the server unhealthy for that time; Compose's retries cover a
  restart of a dependency.
- Revisit when a server gets a dependency that is optional at run time: it then needs a check that warns but does not
  fail.
