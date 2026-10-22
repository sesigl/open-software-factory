import { scenario } from "@opensoftware/testkit";
import { runsOf } from "./otlp.ts";
import { claudeSession, codexSession, openCodeSession } from "./sessions.ts";

scenario("SCN-RUN-081", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" as "claude/session.jsonl", the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy" as "opencode/session.json" and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69" as "codex/rollout.jsonl.bak"',
    async () => {
      await sut.files.put("$INPUT/sessions/claude/session.jsonl", claudeSession());
      await sut.files.put("$INPUT/sessions/opencode/session.json", openCodeSession());
      await sut.files.put("$INPUT/sessions/codex/rollout.jsonl.bak", codexSession());
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog watch sessions --passes 1" at "2026-01-02T00:00:00Z"', async () => {
    run = await sut.cli(["watch", "sessions", "--passes", "1"], { env: { OSF_NOW: "2026-01-02T00:00:00Z" } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"runs.jsonl" has 2 runs with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" and "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"',
    async () => {
      const runs = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(runs.map((exported) => exported.root.attributes["gen_ai.conversation.id"])).toEqual([
        "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d",
        "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy",
      ]);
    },
  );
});
