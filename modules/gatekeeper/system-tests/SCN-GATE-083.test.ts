import { scenario } from "@opensoftware/testkit";
import { putReadme } from "./gate.ts";
import { putEach, type Run, requestArgs, runEach, usageLines } from "./input.ts";

const groups = (maintainers: unknown, reviewers: unknown = ["slack:U0BEN"]) => ({
  maintainers,
  reviewers,
  leads: ["slack:U0LEO"],
});
const FILES = {
  "null.json": null,
  "number.json": 5,
  "text.json": groups("slack:U0ADA"),
  "bare.json": groups(["slack:U0ADA"], ["U0BEN"]),
  "mixed.json": groups(["slack:U0ADA", "U0BEN"]),
  "upper.json": groups(["Slack:U0ADA"]),
  "space.json": groups(["slack:U0ADA ada"]),
};

scenario("SCN-GATE-083", async ({ sut, fakes, given, when, then }) => {
  await given("the README policy and request", async () => {
    await putReadme(sut, fakes);
  });

  await given(
    'the groups files "null.json" with null, "number.json" with 5, "text.json" with a text as members, "bare.json" with the member "U0BEN" in "reviewers", "mixed.json" with the members "slack:U0ADA" and "U0BEN", "upper.json" with the member "Slack:U0ADA" and "space.json" with the member "slack:U0ADA ada"',
    async () => {
      await putEach(sut, FILES);
    },
  );

  let runs: Run[] = [];
  await when('the user runs "gatekeeper request" with each groups file', async () => {
    runs = await runEach(sut, Object.keys(FILES), (file) => requestArgs("policy.rego", file));
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });

  await then(
    'each error output says that the groups file must map each group to its members, like {"maintainers": ["slack:U0ADA"]}',
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(
        usageLines(
          Object.keys(FILES),
          (file) => `${file} must map each group to its members, like {"maintainers": ["slack:U0ADA"]}`,
        ),
      );
    },
  );
});
