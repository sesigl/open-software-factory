// scenario(id, fn): the one system test of a scenario, with its steps, its sut and its fakes.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type TestContext, test } from "vitest";
import { type Fakes, type FakesHandle, makeFakes } from "./fakes/fakes.ts";
import { findModuleRoot, scenarioStatus } from "./support/module.ts";
import { initGit } from "./support/process.ts";
import { type Folders, folders, makeSut, type Sut } from "./sut/sut.ts";

export type StepFn = (label: string, body: () => unknown) => Promise<void>;

export interface ScenarioContext {
  sut: Sut;
  fakes: Fakes;
  given: StepFn;
  when: StepFn;
  then: StepFn;
}

/** Declares the one system test of a scenario. The ID is a string literal so the checks can read it. */
export function scenario(id: string, body: (context: ScenarioContext) => Promise<void>): void {
  test(id, async (vitestContext: TestContext) => {
    const testFile = vitestContext.task.file.filepath;
    const moduleRoot = findModuleRoot(testFile);
    const retries = vitestContext.task.result?.retryCount ?? 0;
    await vitestContext.annotate(id, "scenario");
    if (retries > 0) await vitestContext.annotate(String(retries), "retries");

    const status = scenarioStatus(moduleRoot, id);
    const workspace = mkdtempSync(join(tmpdir(), "osf-sut-"));
    const handle = makeFakes(moduleRoot);
    try {
      const context = makeContext(moduleRoot, folders(workspace), handle);
      if (status !== "planned") return await runBody(body, context, handle);
      // A planned scenario's test is expected to fail until the behavior exists.
      let failed = false;
      try {
        await runBody(body, context, handle);
      } catch {
        failed = true;
      }
      if (!failed) throw new Error(`${id} is planned but its test passes: set @status=implemented.`);
    } finally {
      await handle.close();
      rmSync(workspace, { recursive: true, force: true });
    }
  });
}

/** Runs the steps, then fails when a fake saw a call nobody scripted, even if the steps passed. */
async function runBody(
  body: (context: ScenarioContext) => Promise<void>,
  context: ScenarioContext,
  handle: FakesHandle,
): Promise<void> {
  let failure: unknown;
  try {
    await body(context);
  } catch (error) {
    failure = error;
  }
  const problems = await handle.close();
  if (problems.length > 0) throw new Error(problems.join("\n\n"), { cause: failure });
  if (failure !== undefined) throw failure;
}

function makeContext(moduleRoot: string, dirs: Folders, handle: FakesHandle): ScenarioContext {
  const step =
    (keyword: string): StepFn =>
    async (label, body) => {
      try {
        await body();
      } catch (error) {
        if (error instanceof Error) error.message = `${keyword} "${label}": ${error.message}`;
        throw error;
      }
    };
  initGit(dirs.input);
  return {
    sut: makeSut(moduleRoot, dirs),
    fakes: handle.fakes,
    given: step("Given"),
    when: step("When"),
    // biome-ignore lint/suspicious/noThenProperty: `then` is the Gherkin keyword; the context is never awaited.
    then: step("Then"),
  };
}
