// scenario(id, fn): the one system test of a scenario, with its steps, its sut and its fakes. The test of a Scenario
// Outline runs its body once for each row of the Examples (ADR 0157).
import { rmSync } from "node:fs";
import { type TestContext, test } from "vitest";
import { type Fakes, type FakesHandle, makeFakes } from "./fakes/fakes.ts";
import { type Example, findModuleRoot, scenarioExamples, scenarioShared, scenarioStatus } from "./support/module.ts";
import { initGit } from "./support/process.ts";
import { tempFolder } from "./support/temp.ts";
import { folders, makeSut, type Sut, type SutHandle } from "./sut/sut.ts";

export type { Example };

export type StepFn = (label: string, body: () => unknown) => Promise<void>;

/** The context of a scenario's test; `Column` names the columns of an Outline's Examples. */
export interface ScenarioContext<Column extends string = string> {
  sut: Sut;
  fakes: Fakes;
  given: StepFn;
  when: StepFn;
  then: StepFn;
  /** The row of the Examples this run of a Scenario Outline tests, by column name; empty for a plain scenario. */
  example: Example<Column>;
}

/**
 * Declares the one system test of a scenario. The ID is a string literal so the checks can read it. For a Scenario
 * Outline the test reads the rows of its Examples from the feature file and runs the body once for each, each with a
 * workspace, fakes and sut of its own; it fails when any row failed and names each failed row. Name the columns,
 * `scenario<"field" | "message">(...)`, to read `example.field` as a string.
 */
export function scenario<Column extends string = string>(
  id: string,
  body: (context: ScenarioContext<Column>) => Promise<void>,
): void {
  test(id, async (vitestContext: TestContext) => {
    const testFile = vitestContext.task.file.filepath;
    const moduleRoot = findModuleRoot(testFile);
    const retries = vitestContext.task.result?.retryCount ?? 0;
    await vitestContext.annotate(id, "scenario");
    if (retries > 0) await vitestContext.annotate(String(retries), "retries");

    const status = scenarioStatus(moduleRoot, id);
    const examples = scenarioExamples(moduleRoot, id);
    const failures: { failure: unknown; row: number; example: Example }[] = [];
    for (const [row, example] of (examples ?? [{}]).entries()) {
      const failure = await runOnce(moduleRoot, id, body, example);
      if (failure !== undefined) failures.push({ failure, row: row + 1, example });
    }
    if (status === "planned") {
      // A planned scenario's test is expected to fail until the behavior exists.
      if (failures.length === 0) throw new Error(`${id} is planned but its test passes: set @status=implemented.`);
      return;
    }
    const [first] = failures;
    if (!first) return;
    if (!examples) throw first.failure;
    const rows = failures.map(
      ({ failure, row, example }) =>
        `example ${row} (${Object.entries(example)
          .map(([name, value]) => `${name}=${value}`)
          .join(", ")}): ${failure instanceof Error ? failure.message : String(failure)}`,
    );
    throw new Error(`${failures.length} of ${examples.length} examples of ${id} failed:\n\n${rows.join("\n\n")}`, {
      cause: first.failure,
    });
  });
}

/** One run of the body in a workspace of its own; gives the failure of its steps, or undefined when they passed. */
async function runOnce(
  moduleRoot: string,
  id: string,
  body: (context: ScenarioContext) => Promise<void>,
  example: Example,
): Promise<unknown> {
  const workspace = tempFolder("osf-sut-");
  const handle = makeFakes(moduleRoot);
  let sut: SutHandle | undefined;
  try {
    const dirs = folders(workspace);
    initGit(dirs.input);
    sut = makeSut(moduleRoot, dirs, () => handle.hosts(), id);
    const failure = await runBody(body, makeContext(sut, handle, example), sut, handle);
    // A scenario of a group that starts its own system would hide that it does not share (ADR 0157).
    const tag = scenarioShared(moduleRoot, id);
    if (failure === undefined && tag !== undefined && !sut.sharedUsed().includes(tag)) {
      return new Error(`${id} has the tag @shared=${tag} but did not use sut.shared("${tag}")`);
    }
    return failure;
  } finally {
    await sut?.close();
    await handle.close();
    // A process of the module can still write into the workspace while it is removed (ENOTEMPTY): Node then
    // removes it again, up to 5 times.
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

/**
 * Runs the steps, then fails when a fake saw a call nobody scripted, even if the steps passed. Gives the failure
 * instead of throwing it.
 */
async function runBody(
  body: (context: ScenarioContext) => Promise<void>,
  context: ScenarioContext,
  sut: SutHandle,
  handle: FakesHandle,
): Promise<unknown> {
  let failure: unknown;
  try {
    await body(context);
  } catch (error) {
    failure = error;
  }
  // The module stops before its fakes, so it cannot call them while they close.
  const problems = [...(await sut.close()), ...(await handle.close())];
  if (problems.length > 0) return new Error(problems.join("\n\n"), { cause: failure });
  return failure;
}

function makeContext(sut: SutHandle, handle: FakesHandle, example: Example): ScenarioContext {
  const step =
    (keyword: string): StepFn =>
    async (label, body) => {
      try {
        await body();
      } catch (error) {
        // An Outline's label keeps its parameters `<name>`; the failure shows the row's values in their place.
        const shown = label.replace(/<([^<>]+)>/g, (text, name: string) => example[name] ?? text);
        if (error instanceof Error) error.message = `${keyword} "${shown}": ${error.message}`;
        throw error;
      }
    };
  return {
    sut: sut.sut,
    fakes: handle.fakes,
    given: step("Given"),
    when: step("When"),
    // biome-ignore lint/suspicious/noThenProperty: `then` is the Gherkin keyword; the context is never awaited.
    then: step("Then"),
    example,
  };
}
