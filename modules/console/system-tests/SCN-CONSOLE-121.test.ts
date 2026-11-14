import type { Sandbox } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { sandboxAdapter } from "./sandbox.ts";

scenario("SCN-CONSOLE-121", async ({ sut, fakes, given, when, then }) => {
  let sandbox: Sandbox;
  let env: Record<string, string> = {};
  await given('a sandbox adapter in "CONSOLE_SANDBOX_COMMAND" whose probe reaches the denied host', async () => {
    ({ sandbox, env } = await sandboxAdapter(fakes, { probe: "reached" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  sandbox: a sandbox reached example.com, which its egress does not allow: check the egress proxy of the sandbox adapter"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  sandbox: a sandbox reached example.com, which its egress does not allow: check the egress proxy of the sandbox adapter\n",
      );
    },
  );

  await then('the adapter probed the default template "curlimages/curl:8.17.0"', async () => {
    expect(sandbox.probes().map(({ template }) => template)).toEqual(["curlimages/curl:8.17.0"]);
  });
});
