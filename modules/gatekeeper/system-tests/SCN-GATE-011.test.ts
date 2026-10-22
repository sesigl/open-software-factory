import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-011", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(fakes);
  await given('a policy file "policy.rego" with the line "approvers contains" and nothing after it', async () => {
    await putReadme(sut, fakes, { "policy.rego": "package gatekeeper\n\napprovers contains" });
  });

  await given("the README groups and request", async () => {});

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE], { env });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output names "policy.rego" and the line 3', async () => {
    expect(run.stderr).toContain("OPA cannot evaluate policy.rego: policy.rego:3: ");
  });
});
