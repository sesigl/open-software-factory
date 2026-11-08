import { scenario } from "@opensoftware/testkit";
import { factoryEnv, healthyServer, TOKEN_ROUTES } from "./console.ts";

scenario("SCN-CONSOLE-037", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a foreman, an intake and a gatekeeper whose "/v1/health" is ok and that accept their tokens',
    async () => {
      const [foreman, intake, gatekeeper] = await Promise.all([
        healthyServer(fakes, [{ name: "temporal", ok: true }], TOKEN_ROUTES.foreman),
        healthyServer(fakes, [{ name: "database", ok: true }], TOKEN_ROUTES.intake, 404),
        healthyServer(fakes, [{ name: "opa", ok: true }], TOKEN_ROUTES.gatekeeper, 404),
      ]);
      env = {
        CONSOLE_FOREMAN_URL: foreman.url,
        CONSOLE_FOREMAN_TOKEN: "foreman-token",
        CONSOLE_INTAKE_URL: intake.url,
        CONSOLE_INTAKE_TOKEN: "intake-token",
        CONSOLE_GATEKEEPER_URL: gatekeeper.url,
        CONSOLE_GATEKEEPER_TOKEN: "gatekeeper-token",
      };
    },
  );

  await given('the factory definition with the agent "triage"', async () => {
    env = { ...env, ...(await factoryEnv(sut)) };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'it prints "ok" for "foreman temporal", "foreman token", "intake database", "intake token", "gatekeeper opa", "gatekeeper token" and "factory", then "all 7 checks ok"',
    async () => {
      expect(run.stdout.trim().split("\n")).toEqual([
        "ok    foreman temporal",
        "ok    foreman token",
        "ok    intake database",
        "ok    intake token",
        "ok    gatekeeper opa",
        "ok    gatekeeper token",
        "ok    factory",
        "all 7 checks ok",
      ]);
    },
  );
});
