import { scenario } from "@opensoftware/testkit";

scenario("SCN-OBS-001", async ({ sut, fakes, given, when, then }) => {
  await given("the sample scores from the README", async () => {
    const readme = fakes.fromRepository("modules/observer")["README.md"] as string;
    const block = /^```jsonl (\S+)\n([\s\S]*?)^```$/m.exec(readme);
    if (!block) throw new Error("the README has no sample scores");
    await sut.files.put(`$INPUT/${block[1]}`, block[2] as string);
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

  await then('the output says "research-skill-used: failed 3 of 4 runs (75.0%)"', async () => {
    expect(run.stdout).toContain("research-skill-used: failed 3 of 4 runs (75.0%)");
  });
});
