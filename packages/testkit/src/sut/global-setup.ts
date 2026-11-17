// The testkit's global setup for vitest, `globalSetup: ["@opensoftware/testkit/global-setup"]`: the run's folder of
// shared starts for sut.shared, and their teardown when the run ends (ADR 0157). `testkit run` uses it as it is.
import type { TestProject } from "vitest/node";
import { tempFolder } from "../support/temp.ts";
import { sharedDown } from "./shared.ts";

/** Gives the test processes the run's folder of shared starts; the function it returns takes them down. */
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const dir = tempFolder("osf-shared-");
  project.provide("osfTestkitShared", { dir, owner: process.pid });
  return () => sharedDown(dir);
}
