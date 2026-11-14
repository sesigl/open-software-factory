import { scenario } from "@opensoftware/testkit";
import { sandboxAdapter } from "./sandbox.ts";

scenario("SCN-CONSOLE-122", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a sandbox adapter in "CONSOLE_SANDBOX_COMMAND" that has only the template "alpine:3"', async () => {
    ({ env } = await sandboxAdapter(fakes, { templates: ["alpine:3"] }));
  });

  await given('"CONSOLE_SANDBOX_TEMPLATE" is "node:24"', async () => {
    env = { ...env, CONSOLE_SANDBOX_TEMPLATE: "node:24" };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  sandbox: no template node:24: check CONSOLE_SANDBOX_COMMAND and CONSOLE_SANDBOX_TEMPLATE"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  sandbox: no template node:24: check CONSOLE_SANDBOX_COMMAND and CONSOLE_SANDBOX_TEMPLATE\n",
      );
    },
  );
});
