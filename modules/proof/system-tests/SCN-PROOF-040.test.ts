import { scenario } from "@opensoftware/testkit";

scenario("SCN-PROOF-040", async ({ sut, given, when, then }) => {
  await given('a folder "mcp" with the file "notes.md"', async () => {
    await sut.files.put("$INPUT/mcp/notes.md", "# Session\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof capture --from mcp --scenario SCN-WEB-002"', async () => {
    run = await sut.cli(["capture", "--from", "mcp", "--scenario", "SCN-WEB-002"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output contains "mcp has no screenshot, video or trace"', async () => {
    expect(run.stderr).toContain("mcp has no screenshot, video or trace");
  });
});
