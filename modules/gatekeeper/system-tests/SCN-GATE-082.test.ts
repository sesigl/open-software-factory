import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { putEach, type Run, requestArgs, runEach, usageLines } from "./input.ts";

const RULE = 'package gatekeeper\n\napprovers contains "maintainers"\n\n';
const escalate = (after: string) => `${RULE}escalate_after := "${after}"\n\nescalate_to contains "leads"\n`;
const FILES = {
  "words.rego": escalate("4 hours"),
  "prefix.rego": escalate("about 4h"),
  "suffix.rego": escalate("4hours"),
  "days.rego": `${RULE}expire_after := "2 days"\n`,
};

scenario("SCN-GATE-082", async ({ sut, fakes, given, when, then }) => {
  await given("the README groups and request", async () => {
    await putReadme(sut, fakes);
  });

  await given(
    'the policies "words.rego" with "escalate_after" "4 hours", "prefix.rego" with "escalate_after" "about 4h", "suffix.rego" with "escalate_after" "4hours" and "days.rego" with "expire_after" "2 days"',
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
    `each error output says that the policy's "escalate_after" or "expire_after" must be a duration like "30m", "4h" or "2d"`,
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(
        usageLines(
          Object.keys(FILES),
          (policy) =>
            `the policy's ${policy === "days.rego" ? "expire_after" : "escalate_after"} must be a duration like "30m", "4h" or "2d"`,
        ),
      );
    },
  );
});
