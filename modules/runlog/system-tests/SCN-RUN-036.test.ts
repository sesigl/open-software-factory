import { scenario } from "@opensoftware/testkit";

scenario("SCN-RUN-036", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a folder "sessions" with the file "notes.json" with the text "{}"',
    async () => {
      await sut.files.put("$INPUT/sessions/notes.json", "{}\n");
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog watch sessions --passes 1"', async () => {
    run = await sut.cli(["watch", "sessions", "--passes", "1"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output folder has no "runs.jsonl"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("runs.jsonl");
  });
});
