import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, readmeFiles } from "./foreman.ts";

scenario("SCN-FORE-118", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the README\'s "checks/factory.yaml" whose stage "ship" has "wait: true" and the agent "ship"',
    async () => {
      const factory = (readmeFiles(fakes)["checks/factory.yaml"] as string).replace(
        "    checks: [verify]\n",
        "    checks: [verify]\n    wait: true\n    agent: ship\n",
      );
      expect(factory).toContain("    wait: true\n    agent: ship\n");
      await sut.files.put("$INPUT/factory.yaml", factory);
      // The prompts the factory names, so that only the stage that waits can stop the server.
      for (const [path, text] of Object.entries(readmeFiles(fakes)))
        if (path.startsWith("agents/")) await sut.files.put(`$INPUT/${path}`, text);
      await sut.git.commit("a stage that only waits and names an agent");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "factory.yaml: /workflow/2/agent: a stage that only waits names no agent"',
    async () => {
      expect(run.stderr).toContain("factory.yaml: /workflow/2/agent: a stage that only waits names no agent");
    },
  );
});
