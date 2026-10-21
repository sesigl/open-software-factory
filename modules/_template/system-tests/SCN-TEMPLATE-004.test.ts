import { scenario } from "@opensoftware/testkit";

scenario("SCN-TEMPLATE-004", async ({ sut, given, when, then }) => {
  await given("an empty working folder", async () => {
    await sut.files.clear("$INPUT");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "module-template bye Ada"', async () => {
    run = await sut.cli(["bye", "Ada"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the output contains "usage: module-template hello <name>"', async () => {
    expect(run.stderr).toContain("usage: module-template hello <name>");
  });
});
