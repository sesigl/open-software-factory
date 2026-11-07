import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FGITHUB-003", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('an open pull request in "tester/web"', async () => {
    box = await setup(sut, fakes);
    await openPullRequest(box.forge);
  });

  let zero: Awaited<ReturnType<typeof box.run>>;
  let fraction: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "pr tester/web 0" and "pr tester/web 1.5"', async () => {
    zero = await box.run(["pr", "tester/web", "0"]);
    fraction = await box.run(["pr", "tester/web", "1.5"]);
  });

  await then(
    'both exit with code 2 and the error "forge-github: name the pull request by its number, like 7"',
    async () => {
      const error = "forge-github: name the pull request by its number, like 7\n";
      expect([zero.exitCode, fraction.exitCode], zero.stderr + fraction.stderr).toEqual([2, 2]);
      expect([zero.stderr, fraction.stderr]).toEqual([error, error]);
    },
  );
});
