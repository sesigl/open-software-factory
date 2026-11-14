import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FGITHUB-012", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given(
    'the branch protection of "main" of "tester/web" requires the check "verify", and a ruleset requires the checks "factory" and "verify" and two approvals on "main"',
    async () => {
      box = await setup(sut, fakes);
      await box.json(["protect", box.repo, "main", "--check", "verify"]);
      await box.forge.addRuleset("web", { branches: ["main"], checks: ["factory", "verify"], approvals: 2 });
    },
  );

  let printed: Record<string, unknown>;
  await when('the client runs "rules tester/web main"', async () => {
    printed = await box.json(["rules", box.repo, "main"]);
  });

  await then('rules prints the checks "verify" and "factory" and the approvals 2', async () => {
    expect(printed).toEqual({ checks: ["verify", "factory"], approvals: 2 });
  });
});
