import { scenario } from "@opensoftware/testkit";
import { agentTraceOf, attributed } from "./agent-trace.ts";
import { CART_TS, claudeMultiEditSession, README_MD } from "./sessions.ts";

scenario("SCN-RUN-071", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit, the files "src/cart.ts" and "README.md" and a Claude Code session whose MultiEdit wrote lines 7 to 8, 2 to 3, 3 to 4, nothing and 5 of "src/cart.ts" and that then wrote "README.md"',
    async () => {
      await sut.files.put("$INPUT/src/cart.ts", CART_TS);
      await sut.files.put("$INPUT/README.md", README_MD);
      await sut.files.put("$INPUT/session.jsonl", claudeMultiEditSession());
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export session.jsonl --agent-trace trace.json"', async () => {
    run = await sut.cli(["export", "session.jsonl", "--agent-trace", "trace.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"trace.json" attributes line 1 of "README.md", lines 2 to 5 of "src/cart.ts" and lines 7 to 8 of "src/cart.ts" to "ai" with the model "anthropic/claude-sonnet-5-5", in this order',
    async () => {
      const record = agentTraceOf(await sut.files.read("$INPUT/trace.json"));
      expect(attributed(record)).toEqual([
        "README.md:1-1 ai anthropic/claude-sonnet-5-5",
        "src/cart.ts:2-5 ai anthropic/claude-sonnet-5-5",
        "src/cart.ts:7-8 ai anthropic/claude-sonnet-5-5",
      ]);
    },
  );
});
