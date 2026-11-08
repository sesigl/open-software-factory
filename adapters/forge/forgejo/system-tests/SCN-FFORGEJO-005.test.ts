import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FFORGEJO-005", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web"', async () => {
    box = await setup(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "check tester/web 9b1c2d3 verify done"', async () => {
    run = await box.run(["check", "tester/web", "9b1c2d3", "verify", "done"]);
  });

  await then(
    'check exits with code 2 and the error "forge-forgejo: the state is one of pending, success, failure, error"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toBe("forge-forgejo: the state is one of pending, success, failure, error\n");
      expect(run.stdout).toBe("");
    },
  );
});
