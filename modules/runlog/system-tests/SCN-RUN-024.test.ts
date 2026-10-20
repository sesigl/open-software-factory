import { scenario } from "@opensoftware/testkit";
import { openCodeRepository } from "./given.ts";
import { children, runsOf } from "./otlp.ts";

scenario("SCN-RUN-024", async ({ sut, given, when, then }) => {
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
    '"runs.jsonl" has 1 span "execute_tool edit" and 1 span "execute_tool bash" below the root span',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported && children(exported, "execute_tool edit")).toHaveLength(1);
      expect(exported && children(exported, "execute_tool bash")).toHaveLength(1);
    },
  );

  await then('the "execute_tool bash" span has "gen_ai.tool.call.id" "toolu_oc2" and lasts 9 seconds', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    const [bash] = exported ? children(exported, "execute_tool bash") : [];
    expect(bash?.attributes).toMatchObject({ "gen_ai.tool.name": "bash", "gen_ai.tool.call.id": "toolu_oc2" });
    expect(bash?.seconds).toBe(9);
  });
});
