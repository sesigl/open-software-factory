import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-001", async ({ sut, fakes, given, when, then }) => {
  await given("the sample trial results from the README", async () => {
    const readme = fakes.fromRepository("modules/taskcapture")["README.md"] as string;
    const blocks = [...readme.matchAll(/^```json (jobs\/\S+)\n([\s\S]*?)^```$/gm)];
    if (blocks.length !== 4) throw new Error(`the README has ${blocks.length} trial results, not 4`);
    for (const [, path, content] of blocks) await sut.files.put(`$INPUT/${path}`, content as string);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when("the user runs the quick start command from the README", async () => {
    run = await sut.cli(sut.readme.quickStartArgs());
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output folder contains the file the README promises", async () => {
    expect(await sut.files.list("$OUTPUT")).toContain(sut.readme.quickStartOutput());
  });

  await then('the output says "most efficient: v1 · openrouter/z-ai/glm-5.3-flash"', async () => {
    expect(run.stdout).toContain("most efficient: v1 · openrouter/z-ai/glm-5.3-flash");
  });
});
