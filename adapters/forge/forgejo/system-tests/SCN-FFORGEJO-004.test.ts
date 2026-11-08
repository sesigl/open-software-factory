import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FFORGEJO-004", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web"', async () => {
    box = await setup(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when(`the client runs "check tester/web 9b1c2d3" without the check's name and state`, async () => {
    run = await box.run(["check", "tester/web", "9b1c2d3"]);
  });

  await then(
    'check exits with code 2 and the error "forge-forgejo: name the commit and the check, like check tester/web 9b1c2d3 verify success"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toBe(
        "forge-forgejo: name the commit and the check, like check tester/web 9b1c2d3 verify success\n",
      );
      expect(run.stdout).toBe("");
    },
  );
});
