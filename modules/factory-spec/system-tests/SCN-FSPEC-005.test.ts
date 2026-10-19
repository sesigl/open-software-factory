import { scenario } from "@opensoftware/testkit";

scenario("SCN-FSPEC-005", async ({ sut, given, when, then }) => {
  await given('a factory.yaml that repeats the key "factory" on line 3', async () => {
    await sut.files.put("$INPUT/factory.yaml", "version: 1\nfactory: web-app\nfactory: other\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "factory.yaml:3:1 Map keys must be unique"', async () => {
    expect(run.stdout).toContain("factory.yaml:3:1 Map keys must be unique");
  });
});
