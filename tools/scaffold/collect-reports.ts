// `osf collect-reports`: each package's system tests write their results into the package's own reports/, which turbo
// stores and replays (ADR 0081). This copies them to reports/junit/<name>.xml, reports/coverage/<name>-<file> and the
// runner's speed of the same run to reports/speed/<name>.json (ADR 0103), where the checks read them.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Repo } from "../checks/lib/repo.ts";
import { shortName, workspace } from "../checks/lib/workspace.ts";

export function collectReports(root: string): number {
  for (const unit of workspace(new Repo(root))) {
    const dir = join(root, unit.dir);
    const name = shortName(unit.name);
    const junit = join(dir, "reports", "junit.xml");
    if (existsSync(junit)) {
      mkdirSync(join(root, "reports", "junit"), { recursive: true });
      copyFileSync(junit, join(root, "reports", "junit", `${name}.xml`));
    }
    const speed = join(dir, "reports", "runner-speed.json");
    if (existsSync(speed)) {
      mkdirSync(join(root, "reports", "speed"), { recursive: true });
      copyFileSync(speed, join(root, "reports", "speed", `${name}.json`));
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
