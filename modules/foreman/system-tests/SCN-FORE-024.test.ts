import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-024", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with a scripted harness whose "plan" turn asks to edit "plan.md"',
    async () => {
      server = await serving(sut, fakes, {
        turns: [
          { when: PLAN, tools: [{ title: "edit plan.md", kind: "edit" }], edits: { "plan.md": "1. Add the button" } },
          { when: IMPLEMENT },
        ],
        env: { OSF_DATA: sut.files.path("$OUTPUT/foreman") },
      });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then('the harness shows the tool call "edit plan.md" allowed', async () => {
    expect(server.harness.toolCalls()).toEqual([{ title: "edit plan.md", kind: "edit", outcome: "allowed" }]);
  });

  await then('the run\'s folder holds the "plan.md" the agent wrote', async () => {
    expect(await sut.files.read(`$OUTPUT/foreman/runs/${runId}/plan.md`)).toBe("1. Add the button");
  });
});
