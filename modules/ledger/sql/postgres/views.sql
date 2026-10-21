-- The public views of ledger in PostgreSQL: the same names, columns and meaning as sql/duckdb/views.sql (ADR 0034,
-- ADR 0035). Amounts are USD, durations hours, times UTC.

-- Each run with its agent type, whether it is top-level, its hours and its inference cost: the sum of its spend
-- rows, else its own osf.cost.usd. A run is top-level unless its invoke_agent span lies below another run's.
CREATE OR REPLACE VIEW run_cost AS
WITH RECURSIVE up (run_id, trace_id, span_id, depth) AS (
  SELECT r.run_id, r.trace_id, s.parent_span_id, 1
  FROM runs r JOIN spans s ON s.trace_id = r.trace_id AND s.span_id = r.span_id
  WHERE s.parent_span_id IS NOT NULL
  UNION ALL
  SELECT up.run_id, up.trace_id, s.parent_span_id, up.depth + 1
  FROM up JOIN spans s ON s.trace_id = up.trace_id AND s.span_id = up.span_id
  WHERE s.parent_span_id IS NOT NULL AND up.depth < 10000
),
nested AS (
  SELECT DISTINCT up.run_id FROM up JOIN runs other ON other.trace_id = up.trace_id AND other.span_id = up.span_id
),
spent AS (SELECT run_id, sum(usd) AS usd FROM spend WHERE run_id IS NOT NULL GROUP BY run_id)
SELECT
  r.run_id, r.work_item_id, r.source, r.requester_id, r.agent, r.model, r.started_at, r.ended_at,
  r.run_id NOT IN (SELECT run_id FROM nested) AS top_level,
  extract(epoch FROM r.ended_at - r.started_at)::DOUBLE PRECISION / 3600 AS hours,
  coalesce(spent.usd, r.cost_usd, 0) AS inference_usd
FROM runs r LEFT JOIN spent USING (run_id);

-- Every spent dollar once, with the dimensions to slice it by: each spend row, and the own cost of each run without
-- spend rows. A spend row whose run is unknown is unattributed.
CREATE OR REPLACE VIEW spend_attributed AS
SELECT
  s.started_at AS spent_at, s.usd, r.run_id,
  coalesce(r.source, 'unattributed') AS source,
  coalesce(r.requester_id, 'unattributed') AS user_id,
  coalesce(r.agent, 'unattributed') AS agent,
  coalesce(s.model, r.model, 'unattributed') AS model
FROM spend s LEFT JOIN runs r ON r.run_id = s.run_id
UNION ALL
SELECT r.started_at, r.cost_usd, r.run_id, r.source, r.requester_id, r.agent, coalesce(r.model, 'unattributed')
FROM runs r
WHERE r.cost_usd IS NOT NULL AND r.run_id NOT IN (SELECT run_id FROM spend WHERE run_id IS NOT NULL);

-- Which runs belong to which pull request, and the share of the run's cost each one carries.
CREATE OR REPLACE VIEW pr_runs AS
WITH links AS (
  SELECT pr_url, run_id FROM run_links
  UNION
  SELECT url, run_id FROM pull_requests WHERE run_id IS NOT NULL
  UNION
  SELECT p.url, r.run_id FROM pull_requests p JOIN runs r ON r.work_item_id = p.work_item_id
)
SELECT pr_url, run_id, 1.0::DOUBLE PRECISION / count(*) OVER (PARTITION BY run_id) AS share FROM links;

-- Each pull request with its kickoff, first human review, merge, revert flag and human interactions.
CREATE OR REPLACE VIEW pr_flow AS
WITH first_run AS (
  SELECT pr.pr_url, min(r.started_at) AS started_at FROM pr_runs pr JOIN runs r USING (run_id) GROUP BY pr.pr_url
),
human AS (
  SELECT url, min(reviewed_at) AS first_review_at, count(*) AS interactions FROM reviews WHERE NOT automated GROUP BY url
)
SELECT
  p.url, p.title, p.author_id, p.opened_at,
  coalesce(w.received_at, first_run.started_at) AS kickoff_at,
  human.first_review_at AS first_human_review_at,
  CASE WHEN c.merged THEN c.closed_at END AS merged_at,
  c.closed_at,
  coalesce(c.merged, false) AND starts_with(p.title, 'Revert "') AS is_revert,
  coalesce(human.interactions, 0)::INTEGER AS human_interactions
FROM pull_requests p
LEFT JOIN work_items w ON w.id = p.work_item_id
LEFT JOIN first_run ON first_run.pr_url = p.url
LEFT JOIN human ON human.url = p.url
LEFT JOIN closes c ON c.url = p.url;

-- Each pull request with the inference cost and hours of its runs, by each run's share.
CREATE OR REPLACE VIEW pr_cost AS
SELECT
  p.url, p.title, p.opened_at,
  coalesce(sum(r.inference_usd * pr.share), 0) AS inference_usd,
  coalesce(sum(r.hours * pr.share), 0) AS hours
FROM pull_requests p
LEFT JOIN pr_runs pr ON pr.pr_url = p.url
LEFT JOIN run_cost r ON r.run_id = pr.run_id
GROUP BY p.url, p.title, p.opened_at;
