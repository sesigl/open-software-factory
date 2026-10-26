import { scenario } from "@opensoftware/testkit";
import { readmeFiles } from "./foreman.ts";

scenario("SCN-FORE-011", async ({ sut, fakes, given, when, then }) => {
  await given('the README\'s "factory.yaml"', async () => {
    await sut.files.put("$INPUT/factory.yaml", readmeFiles(fakes)["factory.yaml"] as string);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve" without "FOREMAN_API_TOKEN"', async () => {
    run = await sut.cli(["serve"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the output contains "FOREMAN_API_TOKEN"', async () => {
    expect(run.stderr).toContain("FOREMAN_API_TOKEN");
  });
});
