---
status: accepted
date: 2026-10-22
---

# 0044. The ledger dogfood: token prices, an HTML dashboard page and Vercel

## Context

TODO item T-08 is done when our own cost per pull request is visible on a dashboard. Its last slice is the dogfood:
this repository's spend, `runs/` and pull requests in the dashboard, linked from the README.

Three things were missing.

- **Spend.** ledger takes inference cost from LiteLLM spend rows or from a run's `osf.cost.usd` (ADR 0034). This
  repository has no LiteLLM gateway. Its agents run on a flat subscription. The run records in `runs/` carry token
  usage per model (`gen_ai.usage.*`), but no cost: runlog leaves cost to the gateway (ADR 0023). Ingesting `runs/`
  as they are gives a cost of 0.00 USD for every pull request.
- **A place for the dashboard.** The Grafana dashboard of ADR 0035 needs a PostgreSQL database and a Grafana
  server. The repository has neither.
- **Clean links.** runlog copies every pull request URL a session mentions into `osf.pull_request.urls`, including
  the example URLs of test fixtures (`https://github.com/acme/web/pull/1`). A run's cost was split evenly over all
  of them, so a real pull request got only part of its run's cost.

## Decision

- **`--prices <file>`** on `ledger ingest` and `ledger report` names a LiteLLM price table
  (`model_prices_and_context_window.json`). A run with token usage, without spend rows and without `osf.cost.usd`
  costs: uncached input tokens times `input_cost_per_token`, cache-read tokens times `cache_read_input_token_cost`,
  cache-write tokens times `cache_creation_input_token_cost`, and output tokens times `output_cost_per_token`. Input
  tokens include the cached ones, as the GenAI conventions and runlog write them. A model without cache prices
  pays the input price for cached tokens. A model the table lacks is named in the output, and its runs cost 0. A
  price that is no number exits 2 before anything is written. Spend rows and `osf.cost.usd` still come first.
- **`--html <file>`** on `ledger report` writes the report as one HTML page: tiles for the cost per pull request,
  its split and the revert rate; throughput, runs by agent and a bar chart per day; cycle time; the 20 most
  expensive pull requests as links; spend by source, user, agent and model. The page has no script and loads
  nothing from the network. Every value from the input is escaped, so a pull request title never becomes markup.
  It has light and dark colors.
- **A run's cost splits only over the pull requests in the ledger.** The view `pr_runs` keeps a link only when a
  `pr.opened@v1` event names the pull request. Links to other repositories and fixture URLs carry no cost.
- **The workflow `ledger-dashboard.yml`** runs nightly, on every push to `main` that changes `runs/`, and by hand.
  It builds ledger from the commit, imports this repository's pull requests and reviews with `GITHUB_TOKEN`,
  downloads LiteLLM's price table from its `main` branch, writes `index.html`, `report.json` and `report.md`, puts
  the Markdown into the job summary and the folder into an artifact, and deploys the folder to Vercel with the
  Vercel CLI when the secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` exist. The Vercel project is
  not connected to Git; only the workflow deploys to it.
- The number on the page is the **list-price equivalent** of the tokens, not the subscription bill. It compares
  across teams and models. The subscription can be added as platform cost with `--platform-usd` later.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Token prices, a static HTML page, hosted on Vercel (chosen by the owner) | No database and no server to run; the page works on any static host; Vercel's free tier gives a public URL | A new report format to build and test; three secrets; a list-price number, not the bill |
| Token prices, the same page on GitHub Pages | No new service at all | The owner chose Vercel |
| Token prices, a free hosted PostgreSQL and Grafana Cloud | Uses the Grafana dashboard of ADR 0035 unchanged | Two new services and accounts, a database URL as a secret; a public Grafana link needs a public dashboard, which free tiers limit |
| Move the dogfood to T-21 | No work now | The vision's measurement side has no live example in this repository |
| Prices in runlog (`osf.cost.usd` at export) | One cost per run in the record | A price table in every session's hook; cost would freeze at export time; ADR 0023 leaves cost to the gateway |

## Prior art

- **LiteLLM `model_prices_and_context_window.json`** (BerriAI/litellm, MIT, updated several times a week): prices
  per token for input, output, cache read and cache write per model. Adopted as the format of `--prices`; ledger
  already reads LiteLLM's spend logs. The workflow reads it from `main`, so new models get prices without a change
  here.
- **pydantic `genai-prices`** (MIT, active since 2025): prices with history by date. Richer, but a second format
  next to LiteLLM. Revisit when prices by date matter.
- **Grafana** (AGPL-3.0, active): stays the dashboard for teams with PostgreSQL (ADR 0035). Too much to run for one
  public page.
- **Evidence.dev** (MIT, active) and **Observable Framework** (ISC, active) build static data sites from SQL. Both
  add a build toolchain and client-side JavaScript for one page whose numbers ledger already computes.
- **Vercel CLI** (`vercel`, Apache-2.0, released several times a week): `vercel deploy <folder> --prod` with
  `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. Pinned to 62.0.0 in the workflow, called with `npx`, never a dependency
  of a module.

## Consequences

- `ledger report --html` serves any team: a page to put on any static host, next to the JSON and Markdown report.
- The page is tested at the level of its text, its links, its bars and its escaping. Its look is checked by eye.
- The dogfood page shows list prices of `runs/`. Sessions that did not commit their run record (before ADR 0027)
  are missing; their pull requests show 0.00 USD.
- Revisit when the factory routes calls through LiteLLM (T-14): its spend rows then replace the price table.
