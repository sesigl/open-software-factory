import { scenario } from "@opensoftware/testkit";

scenario("SCN-RUN-054", async ({ sut, given, when, then }) => {
  await given("an empty output folder", async () => {
    await sut.files.clear("$OUTPUT");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog collector gemini"', async () => {
    run = await sut.cli(["collector", "gemini"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the output contains "unknown harness gemini: use claude-code, codex or opencode"', async () => {
    expect(run.stderr).toContain("unknown harness gemini: use claude-code, codex or opencode");
  });

  await then('the output folder has no "collector.yaml"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("collector.yaml");
  });
});
