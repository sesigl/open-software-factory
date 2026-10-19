// The fakes a system test controls instead of real outside systems.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { listFiles, repoRoot } from "../support/module.ts";
import { type ModelGateway, type RunningGateway, type ScriptedReply, startModelGateway } from "./model-gateway.ts";

export interface Fakes {
  /** A fixture file from the module's `system-tests/fixtures/` folder. */
  fixture(name: string): string;
  /** A read-only copy of a folder of this repository, for example `modules/_template`. */
  fromRepository(dir: string): Record<string, string>;
  /** Starts a scripted model gateway. An unscripted call fails the scenario with the request shown. */
  modelGateway(script: ScriptedReply[]): Promise<ModelGateway>;
}

export interface FakesHandle {
  fakes: Fakes;
  /** Stops every fake and returns what went wrong, such as unscripted calls. */
  close(): Promise<string[]>;
}

export function makeFakes(moduleRoot: string): FakesHandle {
  const running: RunningGateway[] = [];
  return {
    fakes: {
      fixture(name) {
        return readFileSync(join(moduleRoot, "system-tests", "fixtures", name), "utf8");
      },
      fromRepository(dir) {
        const root = join(repoRoot(), dir);
        const tree: Record<string, string> = {};
        for (const file of listFiles(root)) tree[relative(root, file)] = readFileSync(file, "utf8");
        return tree;
      },
      async modelGateway(script) {
        const started = await startModelGateway(script);
        running.push(started);
        return started.gateway;
      },
    },
    async close() {
      return (await Promise.all(running.splice(0).map((fake) => fake.close()))).flat();
    },
  };
}
