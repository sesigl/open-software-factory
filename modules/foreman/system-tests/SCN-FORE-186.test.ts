import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, sandboxedFactory } from "./foreman.ts";

/** The sandbox of the agent "implement", the last agent of the README's "sandboxed/factory.yaml". */
const IMPLEMENT_SANDBOX =
  "    secrets: [ref:file/anthropic-api-key]\n    sandbox:\n      template: node:24\n      cpu: 2\n      memory: 4Gi\n      egress: [registry.npmjs.org, api.anthropic.com]\nworkflow:\n";

scenario("SCN-FORE-186", async ({ sut, fakes, given, when, then }) => {
  await given('the README\'s "sandboxed/factory.yaml" whose agent "implement" declares no sandbox', async () => {
    const factory = sandboxedFactory(fakes);
    expect(factory).toContain(IMPLEMENT_SANDBOX);
    await sut.files.put("$INPUT/factory.yaml", factory.replace(IMPLEMENT_SANDBOX, "workflow:\n"));
    await sut.git.commit("a factory whose agent implement has no sandbox");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve" with "FOREMAN_REQUIRE_SANDBOX" set to "true"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN, FOREMAN_REQUIRE_SANDBOX: "true" } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "factory.yaml: /agents/implement: declare a sandbox: FOREMAN_REQUIRE_SANDBOX runs no agent outside one"',
    async () => {
      expect(run.stderr).toContain(
        "factory.yaml: /agents/implement: declare a sandbox: FOREMAN_REQUIRE_SANDBOX runs no agent outside one",
      );
    },
  );

  await then('the output does not name the agent "plan", which declares one', async () => {
    expect(run.stderr).not.toContain("/agents/plan");
  });
});
