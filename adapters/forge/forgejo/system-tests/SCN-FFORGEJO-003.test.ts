import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FFORGEJO-003", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web"', async () => {
    box = await setup(sut, fakes);
  });

  let negative: Awaited<ReturnType<typeof box.run>>;
  let fraction: Awaited<ReturnType<typeof box.run>>;
  await when(
    'the client runs "protect tester/web main --approvals=-1" and "protect tester/web main --approvals=1.5"',
    async () => {
      negative = await box.run(["protect", "tester/web", "main", "--approvals=-1"]);
      fraction = await box.run(["protect", "tester/web", "main", "--approvals=1.5"]);
    },
  );

  await then(
    'both exit with code 2 and the error "forge-forgejo: --approvals takes a number, like --approvals 1"',
    async () => {
      const error = "forge-forgejo: --approvals takes a number, like --approvals 1\n";
      expect([negative.exitCode, fraction.exitCode], negative.stderr + fraction.stderr).toEqual([2, 2]);
      expect([negative.stderr, fraction.stderr]).toEqual([error, error]);
    },
  );
});
