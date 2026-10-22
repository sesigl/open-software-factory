import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-010", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(fakes);
  await given("the README policy, groups and request", async () => {
    await putReadme(sut, fakes);
  });

  await given('"GATEKEEPER_OPA" set to a file that does not exist', async () => {});

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE], { env: { ...env, GATEKEEPER_OPA: "./no-such-opa" } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output says to install OPA or to set "GATEKEEPER_OPA"', async () => {
    expect(run.stderr).toContain("could not start ./no-such-opa (ENOENT): install OPA 1.x");
    expect(run.stderr).toContain("or set GATEKEEPER_OPA");
  });
});
