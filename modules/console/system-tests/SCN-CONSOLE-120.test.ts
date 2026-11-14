import type { Sandbox } from "@opensoftware/testkit";
import { scenario } from "@opensoftware/testkit";
import { sandboxAdapter } from "./sandbox.ts";

scenario("SCN-CONSOLE-120", async ({ sut, fakes, given, when, then }) => {
  let sandbox: Sandbox;
  let env: Record<string, string> = {};
  await given('a sandbox adapter in "CONSOLE_SANDBOX_COMMAND" whose probe finds the denied host refused', async () => {
    ({ sandbox, env } = await sandboxAdapter(fakes));
  });

  await given('"CONSOLE_SANDBOX_TEMPLATE" is "alpine:3"', async () => {
    env = { ...env, CONSOLE_SANDBOX_TEMPLATE: "alpine:3" };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then('it prints "ok    sandbox"', async () => {
    expect(run.stdout, run.stderr).toMatch(/^ok {4}sandbox$/m);
  });

  await then(
    'the adapter ran one probe of the template "alpine:3" for the host "example.com" and left no sandbox',
    async () => {
      expect(sandbox.probes()).toEqual([{ id: "000000000001", template: "alpine:3", host: "example.com" }]);
      expect(sandbox.list()).toEqual([]);
    },
  );
});
