---
status: proposed
date: 2026-10-22
---

# 0044. The ledger dogfood: this repository's cost per pull request on a dashboard

## Context

TODO item T-08 is done when our own cost per pull request is visible on a dashboard. Its last slice is the dogfood:
this repository's spend, `runs/` and pull requests in the dashboard, linked from the README.

Two inputs are missing today.

- **Spend.** ledger takes inference cost from LiteLLM spend rows or from a run's `osf.cost.usd` (ADR 0034). This
  repository has no LiteLLM gateway. Its agents run on a flat subscription. The run records in `runs/` carry token
  usage per model (`gen_ai.usage.*`), but no cost: runlog leaves cost to the gateway (ADR 0023). Ingesting `runs/`
  as they are gives a cost of 0.00 USD for every pull request.
- **A place for the dashboard.** The Grafana dashboard of ADR 0035 needs a PostgreSQL database and a Grafana
  server. The repository has neither, and both are services with credentials that only the owner can create.

A third, smaller finding: runlog copies every pull request URL a session mentions into `osf.pull_request.urls`,
including the example URLs of test fixtures (`https://github.com/acme/web/pull/1`). The dogfood must count only
pull requests of this repository.

## Decision

Open. The pull request that adds this ADR asks the owner to pick one option below. The recommendation is option A.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A. Price the token usage with a price table, and publish a static HTML dashboard to GitHub Pages from the nightly workflow | No new service and no new secret: `GITHUB_TOKEN` reads the pull requests, Pages hosts the page. The cost is the list-price equivalent of the tokens, comparable across teams | A new report format (`ledger report --html`) to build and test. The number is a list-price equivalent, not the subscription bill. Pages must be switched on once in the repository settings |
| B. Price the token usage, and keep the numbers in a free hosted PostgreSQL with a free Grafana Cloud stack | Uses the Grafana dashboard of ADR 0035 unchanged | Two new services, two accounts and a database URL as a secret. A public Grafana link needs a public dashboard, which free tiers limit |
| C. Move the dogfood to T-21 and mark T-08 done with the released tool | No work now; the hourly plan moves on to T-09 | The vision's measurement side (METRIC-001 to -008) has no live example in this repository |

For the cost in options A and B:

- **A price table per model and token kind**, as `ledger report --prices <file>`: a run without spend rows and
  without `osf.cost.usd` costs its input, output, cache-read and cache-write tokens times the table's prices.
- **The subscription as platform cost** (`--platform-usd`) can be added on top. It spreads the monthly fee over
  the pull requests.

## Prior art

- **LiteLLM `model_prices_and_context_window.json`** (BerriAI/litellm, MIT, updated several times a week): prices
  per token for input, output, cache read and cache write per model. Candidate format for `--prices`.
- **pydantic `genai-prices`** (MIT, active since 2025): prices with history by date, as JSON. Richer, but a second
  format next to LiteLLM, which ledger already reads.
- **Grafana public dashboards** (AGPL-3.0, Grafana Labs, active): needed for option B.
- **GitHub Pages with `actions/deploy-pages`** (MIT, GitHub, active): needed for option A.

## Consequences

To be written when the option is chosen.
