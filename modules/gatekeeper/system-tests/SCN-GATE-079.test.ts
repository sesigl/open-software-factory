import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme } from "./gate.ts";
import type { Run } from "./input.ts";

scenario("SCN-GATE-079", async ({ sut, fakes, given, when, then }) => {
  await given("the README groups and request", async () => {
    await putReadme(sut, fakes);
  });

  await given('a policy "policy.rego" that sets only the risk "high"', async () => {
    await sut.files.put("$INPUT/policy.rego", 'package gatekeeper\n\nrisk := "high"\n');
  });

  let run: Run;
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    run = await sut.cli(["request", ...GATE]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output says "policy.rego sets no approvers"', async () => {
    expect(run.stderr).toBe("gatekeeper: policy.rego sets no approvers\n");
  });
});
