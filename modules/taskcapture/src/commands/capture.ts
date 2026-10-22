// taskcapture capture: one merged pull request → one Harbor task in the suite, plus the suite's prompt-injection
// task (ADR 0043). Everything is read and checked before the first file is written.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { check } from "@opensoftware/cli";
import { replaceFolder } from "../adapters/files.ts";
import { readPull } from "../adapters/forge.ts";
import { changesBetween, extractTree, fileAt, hasFile, openRepository, parentOf } from "../adapters/git.ts";
import { INJECTION_TASK, injectionFiles } from "../domain/injection.ts";
import { mergedPull, type PullRef } from "../domain/pull.ts";
import { environment, split, taskFiles } from "../domain/task.ts";

export interface CaptureOptions {
  suite: string;
  git: string | undefined;
  token: string | undefined;
  tests: RegExp;
  image?: string;
  setup?: string;
  testCommand?: string;
}

export async function capture(ref: PullRef, options: CaptureOptions): Promise<string> {
  const pull = mergedPull(ref, (await readPull(ref, options.token)) as Parameters<typeof mergedPull>[1]);
  const repository = await openRepository(options.git, ref.cloneUrl, options.token);
  try {
    const { dir } = repository;
    const parent = await parentOf(dir, pull.mergeCommit);
    const files = split(await changesBetween(dir, parent, pull.mergeCommit), options.tests);
    if (files.tests.length + files.deletedTests.length === 0)
      throw new Error("the pull request changes no test file, so a task could not score it (see --tests)");
    const env = environment(options, await hasFile(dir, parent, "package.json"));
    check(env, "the repository has no package.json; set --test-command");

    const task = { ...taskFiles({ url: ref.url, ...pull, parentCommit: parent }, files, env) } as Record<
      string,
      string | Buffer
    >;
    for (const path of files.tests) task[`tests/files/${path}`] = await fileAt(dir, pull.mergeCommit, path);
    for (const path of files.solution) task[`solution/files/${path}`] = await fileAt(dir, pull.mergeCommit, path);

    const name = `${ref.repo}-${ref.number}`;
    const folder = join(options.suite, name);
    replaceFolder(folder, task);
    mkdirSync(join(folder, "environment", "repo"));
    await extractTree(dir, parent, join(folder, "environment", "repo"));
    replaceFolder(join(options.suite, INJECTION_TASK), injectionFiles);
    return `wrote the task ${name} to ${folder}`;
  } finally {
    repository.close();
  }
}
