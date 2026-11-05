// `osf collect-reports`: each package's system tests write their results into the package's own reports/, which turbo
// stores and replays (ADR 0081). This copies them to reports/junit/<name>.xml and reports/coverage/<name>-<file>,
// where the checks read them.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { Repo } from "../checks/lib/repo.ts";

export function collectReports(root: string): number {
  const repo = new Repo(root);
  if (!repo.exists("pnpm-workspace.yaml")) return 0;
  const globs = ((parse(repo.read("pnpm-workspace.yaml")) as { packages?: string[] }).packages ?? []).map(
    (glob) => `${glob}/package.json`,
  );
  for (const manifest of repo.match(...globs)) {
    const dir = join(root, dirname(manifest));
    const name = ((JSON.parse(readFileSync(join(root, manifest), "utf8")) as { name?: string }).name ?? dir)
      .split("/")
      .at(-1) as string;
    const junit = join(dir, "reports", "junit.xml");
    if (existsSync(junit)) {
      mkdirSync(join(root, "reports", "junit"), { recursive: true });
      copyFileSync(junit, join(root, "reports", "junit", `${name}.xml`));
    }
    const coverage = join(dir, "reports", "coverage");
    if (!existsSync(coverage)) continue;
    mkdirSync(join(root, "reports", "coverage"), { recursive: true });
    for (const file of readdirSync(coverage)) {
      copyFileSync(join(coverage, file), join(root, "reports", "coverage", `${name}-${file}`));
    }
  }
  return 0;
}
