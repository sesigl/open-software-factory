import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FGITHUB-002", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web"', async () => {
    box = await setup(sut, fakes);
  });

  let longer: Awaited<ReturnType<typeof box.run>>;
  let prefixed: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "pr tester/web/pulls 1" and "pr @tester/web 1"', async () => {
    longer = await box.run(["pr", "tester/web/pulls", "1"]);
    prefixed = await box.run(["pr", "@tester/web", "1"]);
  });

  await then(
    'both exit with code 2 and the error "forge-github: name the repository as <owner>/<name>, like tester/web"',
    async () => {
      const error = "forge-github: name the repository as <owner>/<name>, like tester/web\n";
      expect([longer.exitCode, prefixed.exitCode], longer.stderr + prefixed.stderr).toEqual([2, 2]);
      expect([longer.stderr, prefixed.stderr]).toEqual([error, error]);
    },
  );
});
