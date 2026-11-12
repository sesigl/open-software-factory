import { scenario } from "@opensoftware/testkit";
import { ADA, IMPLEMENT, newRunOf, readmeWork, SHIP, servingChecks } from "./foreman.ts";

scenario("SCN-FORE-108", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  let runId = "";
  await given(
    'the server ran the README\'s "checks/factory.yaml", the check "verify" before the stage "ship" ended with "failure", and then a person set it to "success"',
    async () => {
      server = await servingChecks(sut, fakes, { check: "failure", turns: [{ when: IMPLEMENT, reply: "fixed" }] });
      runId = (await server.start(readmeWork(fakes))).data?.runId as string;
      await server.until(runId, "failed");
      await server.check("success");
    },
  );

  let newId = "";
  await when('"github:ada" posts a retry of the run from the stage "implement"', async () => {
    newId = newRunOf(await server.retry(runId, { by: ADA, from: "implement" }));
    await server.until(newId, "complete");
  });

  await then(
    'the "implement" prompt of the new run has the line "Run before: <id> failed in the stage ship: the check verify ended with failure"',
    async () => {
      const prompts = server.prompts(IMPLEMENT);
      expect(prompts).toHaveLength(2);
      expect(prompts[0]).not.toContain("Run before:");
      expect(prompts[1]).toContain(
        `\n\nRun before: ${runId} failed in the stage ship: the check verify ended with failure\n`,
      );
    },
  );

  await then('no later prompt of the new run has a line that starts with "Run before:"', async () => {
    expect(server.prompts(SHIP)).toHaveLength(1);
    expect(server.prompts("Run before:")).toHaveLength(1);
  });
});
