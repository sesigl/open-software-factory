import { scenario } from "@opensoftware/testkit";
import { openCodeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-069", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"',
    async () => {
      await openCodeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.json"', async () => {
    await sut.cli(["export", "session.json"]);
  });

  await then(
    'the spans in "runs.jsonl" are "invoke_agent", 2 "chat claude-sonnet-5-5", "execute_tool edit", "execute_tool bash", "execute_tool read" and "execute_tool write", in this order',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.spans.map((span) => span.name)).toEqual([
        "invoke_agent",
        "chat claude-sonnet-5-5",
        "chat claude-sonnet-5-5",
        "execute_tool edit",
        "execute_tool bash",
        "execute_tool read",
        "execute_tool write",
      ]);
    },
  );
});
