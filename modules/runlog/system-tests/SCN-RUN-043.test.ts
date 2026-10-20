import { scenario } from "@opensoftware/testkit";
import { claudeSession } from "./sessions.ts";

scenario("SCN-RUN-043", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a folder "sessions" with a Claude Code subagent transcript of the session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"',
    async () => {
      // Claude Code writes a subagent's lines with the parent's session ID and isSidechain true.
      const subagent = claudeSession("2025-12-31T23:50")
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.stringify({ ...JSON.parse(line), isSidechain: true, agentId: "a1b2c3" }))
        .join("\n");
      await sut.files.put("$INPUT/sessions/project/5b8e0c7e/subagents/agent-a1b2c3.jsonl", `${subagent}\n`);
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
