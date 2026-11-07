import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { expectUsageErrors, putEach, type Run, requestArgs, runEach } from "./input.ts";

const RULE = "package gatekeeper\n\n";
const FILES = {
  "text.rego": `${RULE}approvers := "maintainers"\n`,
  "upper.rego": `${RULE}approvers contains "Maintainers"\n`,
  "number.rego": `${RULE}approvers contains 7\n`,
  "leads.rego": `${RULE}approvers contains "maintainers"\n\nescalate_after := "4h"\n\nescalate_to contains "Leads"\n`,
};

scenario("SCN-GATE-077", async ({ sut, fakes, given, when, then }) => {
  await given("the README groups and request", async () => {
    await putReadme(sut, fakes);
  });

  await given(
    'the policies "text.rego" with the approvers "maintainers" as a text, "upper.rego" with the approver "Maintainers", "number.rego" with the approver 7 and "leads.rego" with the escalation group "Leads"',
    async () => {
      await putEach(sut, FILES);
    },
  );

  let runs: Run[] = [];
  await when('the user runs "gatekeeper request" with each policy', async () => {
    runs = await runEach(sut, Object.keys(FILES), (policy) => requestArgs(policy));
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2, 2]);
  });

  await then(
    `each error output says that the policy's "approvers" or "escalate_to" must be a set of group names like "maintainers"`,
    async () => {
      expectUsageErrors(
        runs,
        Object.keys(FILES),
        (policy) =>
          `the policy's ${policy === "leads.rego" ? "escalate_to" : "approvers"} must be a set of group names like "maintainers"`,
      );
    },
  );
});
