// Problems from scores: one problem per scorer that failed often enough, with its reasons and its failed runs.
import type { Score } from "@opensoftware/contracts";

/** The latest score of one scorer for one run. */
export interface Verdict {
  run: string;
  trace: string;
  time: string;
  failed: boolean;
  reason: string;
}

export interface FailedRun {
  run: string;
  trace: string;
  time: string;
  reason: string;
  /** The run record's transcript and pull requests. */
  links: string[];
}

export interface Problem {
  /** The scorer's name: a scorer is one failure mode. */
  id: string;
  failures: number;
  scored: number;
  failureRate: number;
  reasons: { reason: string; count: number }[];
  runs: FailedRun[];
}

/** The latest BOOLEAN score of each run, by scorer name. A later line wins a tie. */
export function verdictsByScorer(scores: Score[]): Map<string, Verdict[]> {
  const byScorer = new Map<string, Map<string, Verdict>>();
  for (const score of scores) {
    if (score.dataType !== "BOOLEAN") continue;
    const runs = byScorer.get(score.name) ?? new Map<string, Verdict>();
    byScorer.set(score.name, runs);
    const run = score.metadata["osf.run.id"];
    const known = runs.get(run);
    if (known && Date.parse(known.time) > Date.parse(score.timestamp)) continue;
    runs.set(run, {
      run,
      trace: score.traceId,
      time: score.timestamp,
      failed: score.value === 0,
      reason: score.comment?.trim() ?? "",
    });
  }
  return new Map([...byScorer].map(([name, runs]) => [name, [...runs.values()]]));
}

/** Every scorer with at least `minFailures` failed runs, most failures first. */
export function problemsOf(scores: Score[], runs: Map<string, RunInfo>, minFailures: number): Problem[] {
  const problems: Problem[] = [];
  for (const [id, verdicts] of verdictsByScorer(scores)) {
    const failed = verdicts.filter((verdict) => verdict.failed);
    if (failed.length < minFailures) continue;
    problems.push({
      id,
      failures: failed.length,
      scored: verdicts.length,
      failureRate: failed.length / verdicts.length,
      reasons: reasonsOf(failed),
      runs: failed
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.run.localeCompare(b.run))
        .map(({ run, trace, time, reason }) => ({ run, trace, time, reason, links: runs.get(run)?.links ?? [] })),
    });
  }
  return problems.sort((a, b) => b.failures - a.failures || a.id.localeCompare(b.id));
}

function reasonsOf(failed: Verdict[]): Problem["reasons"] {
  const counts = new Map<string, number>();
  for (const { reason } of failed) if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

/** What a run record tells about a run: its transcript and pull requests, and when it started. */
export interface RunInfo {
  links: string[];
  start: string | undefined;
}

type Attributes = Record<string, unknown>;

/** The run info of each run, from the root spans of run records. */
export function runInfoOf(
  spans: { parentSpanId: string | undefined; start: bigint; resource: Attributes; attributes: Attributes }[],
): Map<string, RunInfo> {
  const runs = new Map<string, RunInfo>();
  for (const span of spans) {
    const run = span.resource["osf.run.id"];
    if (span.parentSpanId || typeof run !== "string") continue;
    const links = [span.attributes["osf.transcript.uri"], span.attributes["osf.pull_request.urls"]].flat();
    runs.set(run, {
      links: links.filter((link): link is string => typeof link === "string"),
      start: span.start ? new Date(Number(span.start / 1_000_000n)).toISOString() : undefined,
    });
  }
  return runs;
}
