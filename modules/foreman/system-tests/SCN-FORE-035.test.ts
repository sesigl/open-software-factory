import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-035", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness whose "plan" turn writes "plan.md"',
    async () => {
      server = await serving(sut, fakes, {
        factory: sandboxedFactory(fakes),
        sandbox: {},
        turns: [{ when: PLAN, edits: { "plan.md": "1. Add the button" } }, { when: IMPLEMENT }],
        env: { OSF_DATA: sut.files.path("$OUTPUT/foreman") },
      });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then('the run\'s folder holds the "plan.md" the agent wrote', async () => {
    expect(await sut.files.read(`$OUTPUT/foreman/runs/${runId}/plan.md`)).toBe("1. Add the button");
  });

  await then('the harness adapter of the "implement" stage started in a sandbox that held "plan.md"', async () => {
    const harness = (server.sandbox?.execs() ?? []).filter(({ command }) =>
      command.join(" ").includes(sut.adapter("harness/acp")),
    );
    expect(harness.map(({ files }) => files)).toEqual([[runId], [runId, `${runId}/plan.md`]]);
  });
});
