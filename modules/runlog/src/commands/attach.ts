// runlog attach <session file>: the launcher's command when a stage ends. The run joins the launcher's trace from
// TRACEPARENT and records the outcome of the stage (ADR 0024).
import { parentOf } from "../domain/launch.ts";
import { type ExportOptions, exportRun, readSessionFile } from "./export.ts";

export async function attachSession(
  file: string,
  traceparent: string | undefined,
  outcome: string | undefined,
  options: ExportOptions,
): Promise<string> {
  const parent = parentOf(traceparent);
  if (!parent) throw new Error("runlog attach needs a W3C TRACEPARENT from the launcher");
  return exportRun(readSessionFile(file), options, { parent, outcome });
}
