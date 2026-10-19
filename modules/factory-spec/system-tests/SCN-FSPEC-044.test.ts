import { scenario } from "@opensoftware/testkit";
import { appliedWithHook, forgeEnv, hooks, INTAKE } from "./forge.ts";

scenario("SCN-FSPEC-044", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();

  await given(
    'the factory with the automation on "forgejo.issue.labeled(auto-implement)" was applied to "tester/web-app"',
    async () => {
      await appliedWithHook(sut, forge);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply" again', async () => {
    run = await sut.cli(["apply"], { env: forgeEnv(forge) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "webhook of tester/web-app: updated"', async () => {
    expect(run.stdout).toContain("webhook of tester/web-app: updated");
  });

  await then(
    'the repository "tester/web-app" has one webhook to "http://intake.example.invalid/hooks" for the event "issue_label"',
    async () => {
      expect(await hooks(forge)).toEqual([
        expect.objectContaining({ config: expect.objectContaining({ url: INTAKE }), events: ["issue_label"] }),
      ]);
    },
  );
});
