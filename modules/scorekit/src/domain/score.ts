// One score record of the `score` contract from a verdict (ADR 0032).
import { createHash } from "node:crypto";
import type { Score } from "@opensoftware/contracts";
import type { Verdict } from "./judge.ts";
import type { Run } from "./runs.ts";
import type { Scorer } from "./scorer.ts";

export function scoreOf(
  scorer: Scorer,
  run: Run,
  verdict: Verdict,
  judge: { model: string; cost?: number; now: string },
): Score {
  const session = run.root.attributes["gen_ai.conversation.id"];
  return {
    id: createHash("sha256").update(`${scorer.name}\n${run.id}`).digest("hex").slice(0, 32),
    name: scorer.name,
    value: verdict.result === "pass" ? 1 : 0,
    dataType: "BOOLEAN",
    traceId: run.traceId,
    ...(typeof session === "string" ? { sessionId: session } : {}),
    comment: verdict.reason,
    timestamp: judge.now,
    source: "API",
    metadata: {
      "osf.run.id": run.id,
      "osf.scorer.version": scorer.version,
      "osf.judge.model": judge.model,
      ...(judge.cost === undefined ? {} : { "osf.judge.cost.usd": judge.cost }),
    },
  };
}

export const runOf = (score: Score): string => score.metadata["osf.run.id"];
export const costOf = (score: Score): number => Number(score.metadata["osf.judge.cost.usd"] ?? 0);
