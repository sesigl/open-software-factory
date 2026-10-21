// A report.json for "taskcapture route", made by "taskcapture report" from trial results, and the deployments of
// the LiteLLM config route writes.
import { putJob, type TrialResult } from "./results.ts";

export { THREE_MODELS } from "./results.ts";

interface Sut {
  files: { put(path: string, content: string): Promise<void>; read(path: string): Promise<string> };
  cli(args: string[]): Promise<{ exitCode: number; stderr: string }>;
}

/** Runs "taskcapture report --out report.json v1" on these trials, so $INPUT/report.json is a real report. */
export async function putReport(sut: Sut, trials: TrialResult[]): Promise<void> {
  await putJob(sut, "v1", trials);
  const run = await sut.cli(["report", "--out", "report.json", "v1"]);
  if (run.exitCode !== 0) throw new Error(`taskcapture report failed: ${run.stderr}`);
}

/** The text of $OUTPUT/litellm-config.yaml. */
export const readConfig = (sut: Sut): Promise<string> => sut.files.read("$OUTPUT/litellm-config.yaml");

/**
 * The entries of "model_list" in the config route writes: each "- model_name:" item with its litellm_params model
 * and tags, in flow ("[ a, b ]") or block ("- a") style.
 */
export async function deployments(sut: Sut): Promise<unknown[]> {
  const list = /^model_list:\n((?: {2}.*\n)*)/m.exec(await readConfig(sut))?.[1] ?? "";
  return list
    .split(/^ {2}- /m)
    .filter((item) => item.trim())
    .map((item) => {
      const flow = /^ +tags: \[(.*)\]$/m.exec(item)?.[1];
      const block = /^ +tags:\n((?: {8}- .*\n?)*)/m.exec(item)?.[1];
      const tags =
        flow !== undefined ? flow.split(",") : (block ?? "").split("\n").map((line) => line.replace(/^ *- /, ""));
      return {
        model_name: /^model_name: (.*)$/m.exec(item)?.[1],
        litellm_params: {
          model: /^ +model: (.*)$/m.exec(item)?.[1],
          tags: tags.map((tag) => tag.trim()).filter(Boolean),
        },
      };
    });
}
