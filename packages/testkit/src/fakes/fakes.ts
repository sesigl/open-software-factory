// The fakes a system test controls: fixtures today; the scripted model gateway, harness and services follow.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { listFiles, repoRoot } from "../support/module.ts";

export interface Fakes {
  /** A fixture file from the module's `system-tests/fixtures/` folder. */
  fixture(name: string): string;
  /** A read-only copy of a folder of this repository, for example `modules/_template`. */
  fromRepository(dir: string): Record<string, string>;
}

export function makeFakes(moduleRoot: string): Fakes {
  return {
    fixture(name) {
      return readFileSync(join(moduleRoot, "system-tests", "fixtures", name), "utf8");
    },
    fromRepository(dir) {
      const root = join(repoRoot(), dir);
      const tree: Record<string, string> = {};
      for (const file of listFiles(root)) tree[relative(root, file)] = readFileSync(file, "utf8");
      return tree;
    },
  };
}
