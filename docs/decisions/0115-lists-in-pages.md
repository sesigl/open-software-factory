---
status: accepted
date: 2026-11-13
---

# 0115. Lists in pages

## Context

T-48: `GET /v1/runs` of the foreman listed every run of its task queue and read each run's view on its own: the
result of a run that ended, a query, which replays the run's history in a worker, of a run that still runs (ADR
0071). The console's runs page calls it every 10 seconds, so the page grew slower with every run and kept the
foreman's worker busy. intake's `GET /v1/inbox` answered the 50 latest work items and had no way to the next ones.

## Decision

- Both lists take `limit` (1 to 500, 50 by default) and `cursor`, and answer `next`, the cursor of the next page,
  while more follow. Another `limit` or a cursor that is no page of the list is a usage error (400). The parameters
  and `next` are optional additions to `contracts/typespec/` (no major version).
- The foreman's cursor is Temporal's `nextPageToken` in a JSON envelope `{"page": …}` in base64url, so a cursor the
  foreman did not write is refused at once (Temporal's client retries a token the server cannot read for about 20
  seconds); a page is one `ListWorkflowExecutions` call. With
  `state`, the foreman filters the page, so a page may hold fewer runs than `limit` and still have a `next`.
- Each run keeps its view in its memo: the foreman starts the workflow with the memo `view`, and the workflow upserts it
  after each fact it applies, behind the patch `memo-view`, so a replay of a run that started before schedules the
  same commands. The run list reads the views from the memos, without a query or result per run. A run without a memo
  (one that started before) is read with the query, as before.
- intake's cursor is the received time and ID of the page's last work item in base64url; a page is one keyset query
  on `(received_at DESC, id)`, with an index.
- The console's runs page asks each foreman for one page and links "Next page" with `?page=`, the cursors of all
  foremen in base64url JSON; a foreman whose runs ended on an earlier page is not asked again. The work page passes
  intake's cursor on as `?cursor=`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Memo with the view (chosen) | One visibility call per page; works with the dev server and every visibility store | The memo grows with the view; one upsert per fact |
| Custom search attributes (state, title) | Temporal could filter by state, so pages stay full | Must be registered in every namespace (dev server flags, chart), and the list still needs the view's fields |
| Keep the query per run, page only | Smallest change | A page of 50 still asks 50 queries, each a replay in the worker |
| Offset pages (`?page=3`) | Simple links | Temporal has no offset; intake's offset shifts while work arrives |

## Prior art

No new module, dependency or service. Temporal's visibility API (`ListWorkflowExecutions` with `pageSize` and
`nextPageToken`) and `upsertMemo` are part of the pinned SDK 1.24 (MIT, maintained). The cursor and `next` follow the
pattern of the GitHub and Stripe APIs (an opaque cursor, a page size with a maximum).

## Consequences

- The runs page's time no longer grows with the number of runs. Measured on a development machine with 1000 runs in
  the Temporal dev server: see `modules/foreman/AGENTS.md#budget`.
- Every applied fact adds an upsert to the run's history. Revisit if views grow near Temporal's memo size limit.
- A filtered page can be short; filtering in Temporal needs search attributes (a later ADR).
