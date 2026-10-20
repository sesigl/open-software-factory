import { scenario } from "@opensoftware/testkit";

scenario("SCN-RUN-019", async ({ sut, given, when, then }) => {
  await given('a file "notes.txt" with the text "hello"', async () => {
    await sut.files.put("$INPUT/notes.txt", "hello\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export notes.txt"', async () => {
    run = await sut.cli(["export", "notes.txt"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "notes.txt is neither a Claude Code nor a Codex session"', async () => {
    expect(run.stderr).toContain("notes.txt is neither a Claude Code nor a Codex session");
  });
});
