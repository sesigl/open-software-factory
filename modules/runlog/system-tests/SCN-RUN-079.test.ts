import { scenario } from "@opensoftware/testkit";

scenario("SCN-RUN-079", async ({ sut, given, when, then }) => {
  await given('a file "chat.json" with the text "{\\"messages\\": []}"', async () => {
    await sut.files.put("$INPUT/chat.json", '{"messages": []}');
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export chat.json"', async () => {
    run = await sut.cli(["export", "chat.json"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "chat.json is not a Claude Code, Codex or OpenCode session"', async () => {
    expect(run.stderr).toContain("chat.json is not a Claude Code, Codex or OpenCode session");
  });
});
