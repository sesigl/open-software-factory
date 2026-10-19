// `make test-scenario ID=SCN-REPO-002`: runs the one system test of a scenario in its package.
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export function testScenario(root: string, args: string[]): number {
  const id = args[0];
  if (!id || !/^SCN-[A-Z][A-Z0-9]*-\d{3}$/.test(id)) {
    process.stderr.write("Give a scenario ID: osf test-scenario SCN-REPO-002\n");
    return 2;
  }
  const listed = spawnSync("git", ["ls-files", "-co", "--exclude-standard", `*/system-tests/${id}.test.ts`], {
    cwd: root,
    encoding: "utf8",
  });
  const files = listed.stdout.split("\n").filter(Boolean);
  if (files.length !== 1) {
    process.stderr.write(`Expected one system test named ${id}.test.ts, found ${files.length}\n`);
    return 1;
  }
  const file = files[0] as string;
  const pkg = file.slice(0, file.indexOf("/system-tests/"));
  const test = spawnSync("pnpm", ["exec", "vitest", "run", file.slice(pkg.length + 1)], {
    cwd: join(root, pkg),
    stdio: "inherit",
  });
  return test.status ?? 1;
}
