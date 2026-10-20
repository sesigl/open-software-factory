import { scenario } from "@opensoftware/testkit";

scenario("SCN-RUN-056", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a folder "sessions" that holds only "notes.json", which is no session',
    async () => {
      await sut.files.put("$INPUT/sessions/notes.json", '{ "todo": "export the run" }\n');
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export --latest sessions"', async () => {
    run = await sut.cli(["export", "--latest", "sessions"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "no Claude Code, Codex or OpenCode session below sessions"', async () => {
    expect(run.stdout + run.stderr).toContain("no Claude Code, Codex or OpenCode session below sessions");
  });

  await then('the output folder has no "runs.jsonl"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("runs.jsonl");
  });
});
