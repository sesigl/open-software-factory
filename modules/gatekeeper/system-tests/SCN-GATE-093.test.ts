import { scenario } from "@opensoftware/testkit";
import { serving } from "./server.ts";

const GROUPS = JSON.stringify({
  maintainers: ["slack:U0EXAMPLE"],
  reviewers: ["slack:U0ADA", "slack:U0BEN"],
  leads: ["slack:U0LEO"],
});

scenario("SCN-GATE-093", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the README policy and a groups file whose group "maintainers" has only the example\'s member "slack:U0EXAMPLE"',
    async () => {},
  );

  await when('the server starts for the channel "slack:C0GATES"', async () => {
    await serving(sut, fakes, { change: { "groups.json": GROUPS } });
  });

  await then(
    `its error output says 'gatekeeper: the group "maintainers" in groups.json has no member but the example's slack:U0EXAMPLE, so nobody decides its gates: put its people in groups.json'`,
    async () => {
      expect(sut.http.output().stderr).toContain(
        `gatekeeper: the group "maintainers" in groups.json has no member but the example's slack:U0EXAMPLE, so nobody decides its gates: put its people in groups.json\n`,
      );
    },
  );

  await then("its error output names no other group", async () => {
    expect(sut.http.output().stderr.match(/the group "/g)).toHaveLength(1);
  });
});
