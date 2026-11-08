import { scenario } from "@opensoftware/testkit";
import { factoryEnv, healthyServer, TOKEN_ROUTES } from "./console.ts";

const NATS = "the durable consumer of the run events is not attached: check INTAKE_NATS_URL";

scenario("SCN-CONSOLE-038", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given("a foreman that refuses the console's token", async () => {
    const foreman = await healthyServer(fakes, [{ name: "temporal", ok: true }], TOKEN_ROUTES.foreman, 401);
    env = { CONSOLE_FOREMAN_URL: foreman.url, CONSOLE_FOREMAN_TOKEN: "wrong-token", ...(await factoryEnv(sut)) };
  });

  await given(`an intake whose "/v1/health" answers 503 with the check "nats" failing with "${NATS}"`, async () => {
    const intake = await healthyServer(
      fakes,
      [
        { name: "database", ok: true },
        { name: "nats", ok: false, detail: NATS },
      ],
      TOKEN_ROUTES.intake,
      404,
    );
    env = { ...env, CONSOLE_INTAKE_URL: intake.url, CONSOLE_INTAKE_TOKEN: "intake-token" };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  foreman token: foreman refuses the token: set CONSOLE_FOREMAN_TOKEN to its FOREMAN_API_TOKEN"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  foreman token: foreman refuses the token: set CONSOLE_FOREMAN_TOKEN to its FOREMAN_API_TOKEN\n",
      );
    },
  );

  await then(`it prints "FAIL  intake nats: ${NATS}"`, async () => {
    expect(run.stdout).toContain(`FAIL  intake nats: ${NATS}\n`);
    expect(run.stdout).toContain("ok    intake database\n");
  });
});
