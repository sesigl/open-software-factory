import { scenario } from "@opensoftware/testkit";
import { agentTraceOf, attributed } from "./agent-trace.ts";
import { LOGIN_TS, openCodeSession } from "./sessions.ts";

scenario("SCN-RUN-039", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit, the file "src/login.ts" and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy" that edited lines 3 to 4 of it',
    async () => {
      await sut.files.put("$INPUT/src/login.ts", LOGIN_TS);
      await sut.files.put("$INPUT/session.json", openCodeSession());
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export session.json --agent-trace trace.json"', async () => {
    run = await sut.cli(["export", "session.json", "--agent-trace", "trace.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"trace.json" attributes lines 3 to 4 of "src/login.ts" to "ai" with the model "anthropic/claude-sonnet-5-5"',
    async () => {
      const record = agentTraceOf(await sut.files.read("$INPUT/trace.json"));
      expect(attributed(record)).toEqual(["src/login.ts:3-4 ai anthropic/claude-sonnet-5-5"]);
    },
  );
});
