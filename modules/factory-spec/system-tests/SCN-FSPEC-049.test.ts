import { scenario } from "@opensoftware/testkit";
import { putFactory } from "./forge.ts";

scenario("SCN-FSPEC-049", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" works on "tester/web-app" and has the automation on "forgejo.issue.labeled(auto-implement)"',
    async () => {
      await putFactory(sut, "tester", ["forgejo.issue.labeled(auto-implement)"]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply" without FACTORY_FORGE_URL', async () => {
    run = await sut.cli(["apply"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output contains "set FACTORY_FORGE_URL"', async () => {
    expect(run.stderr).toContain("set FACTORY_FORGE_URL");
  });
});
