import { scenario } from "@opensoftware/testkit";
import { appliedWithHook, changeHookUrl, forgeEnv } from "./forge.ts";

scenario("SCN-FSPEC-034", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();
  await given('the factory was applied with a webhook on the Forgejo repository "tester/web"', async () => {
    await appliedWithHook(sut, forge);
  });

  await given('a person changed the URL of the webhook to "http://elsewhere.example/hook" in Forgejo', async () => {
    await changeHookUrl(forge, "http://elsewhere.example/hook");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"], { env: forgeEnv(sut, forge) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output contains "! webhook tester/web.url: \\"http://intake.example/webhooks/forge\\" -> \\"http://elsewhere.example/hook\\""',
    async () => {
      expect(run.stdout).toContain(
        '! webhook tester/web.url: "http://intake.example/webhooks/forge" -> "http://elsewhere.example/hook"',
      );
    },
  );

  await then('the output contains "Plan: 0 to add, 0 to change, 0 to remove, 1 drifted."', async () => {
    expect(run.stdout).toContain("Plan: 0 to add, 0 to change, 0 to remove, 1 drifted.");
  });
});
