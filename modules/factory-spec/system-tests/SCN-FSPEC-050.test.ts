import { scenario } from "@opensoftware/testkit";
import { putFactory } from "./forge.ts";

scenario("SCN-FSPEC-050", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" works on "tester/web-app" and has the automation on "forgejo.wiki.edited"',
    async () => {
      await putFactory(sut, "tester", ["forgejo.wiki.edited"]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output contains "no Forgejo webhook event for \\"forgejo.wiki.edited\\""', async () => {
    expect(run.stderr).toContain('no Forgejo webhook event for "forgejo.wiki.edited"');
  });
});
