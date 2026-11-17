// `osf released-images scenarios | report`: the parts of the workflow released-images that run without GitHub (ADR
// 0169). The workflow starts the deploy suite's Compose scenarios on the images that publish-images released, and
// tells the maintainers in one issue when they fail.
//   osf released-images scenarios
//       the system tests to run, one per line, relative to deploy/: each implemented scenario of deploy/features/
//       except the chart's (helm.feature: this job starts no kind cluster) and those tagged @images=commit, which
//       prove the images of the commit
//   osf released-images report <junit.xml> --run <url> --ref <commit>
//       the text of the issue: the run, the released commit and the IDs of the scenarios that failed in the report
//   osf released-images report --passed --run <url> --ref <commit>
//       the comment on the open issue when a later run passed
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFeature, parseJUnit, scenarioIdOf, statusOf, tagValues } from "@opensoftware/spec-files";
import { Repo } from "../checks/lib/repo.ts";

const FEATURES = "deploy/features/*.feature";
/** The chart's scenarios need a kind cluster, which this job does not start. */
const CHART = "deploy/features/helm.feature";
const ID = /SCN-[A-Z][A-Z0-9]*-\d{3}/;

export function releasedImages(root: string, args: string[]): number {
  const [command, ...rest] = args;
  if (command === "scenarios") return scenarios(root);
  if (command === "report") return report(rest);
  console.error("Usage: osf released-images scenarios | report [<junit.xml> | --passed] --run <url> --ref <commit>");
  return 2;
}

function scenarios(root: string): number {
  const repo = new Repo(root);
  const files = repo
    .match(FEATURES)
    .filter((file) => file !== CHART)
    .sort()
    .flatMap((file) => parseFeature(file, repo.read(file)).scenarios)
    .filter((each) => statusOf(each) === "implemented" && !tagValues(each.tags, "images").includes("commit"))
    .flatMap((each) => each.ids.map((id) => `system-tests/${id}.test.ts`));
  for (const file of files) console.log(file);
  return 0;
}

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

function report(args: string[]): number {
  const run = option(args, "--run");
  const ref = option(args, "--ref");
  if (!run || !ref) {
    console.error("osf released-images report: give --run <url> and --ref <commit>");
    return 2;
  }
  if (args.includes("--passed")) {
    console.log(
      `The deploy scenarios passed on the released images of ${ref}: ${run}. A person closes this issue once its cause is fixed.`,
    );
    return 0;
  }
  const junit = args.find((arg, index) => !arg.startsWith("--") && !args[index - 1]?.startsWith("--"));
  const path = junit ? resolve(junit) : undefined;
  const failed =
    path && existsSync(path)
      ? [
          ...new Set(
            parseJUnit(readFileSync(path))
              .filter((test) => test.status === "failed")
              .map((test) => scenarioIdOf(test, ID) ?? test.name),
          ),
        ].sort()
      : [];
  const lines = [`The deploy scenarios failed on the released images of ${ref}: ${run}`, ""];
  if (failed.length > 0) {
    lines.push("The scenarios that failed:", "", ...failed.map((id) => `- ${id}`));
  } else {
    lines.push("No scenario failed: a step before or after the scenarios failed, like the pull of a released image.");
  }
  lines.push(
    "",
    "What to do: skills/release-packages/SKILL.md, the step on the job on the released images. Run the workflow",
    "released-images again by hand once a fix is released; it comments here when it passes.",
  );
  console.log(lines.join("\n"));
  return 0;
}
