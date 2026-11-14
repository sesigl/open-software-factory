import { scenario } from "@opensoftware/testkit";
import { ENV, EXAMPLE } from "./setup.ts";

scenario("SCN-REPO-133", async ({ sut, given, when, then }) => {
  await given('a "deploy/compose/.env.example" with "POSTGRES_PASSWORD="', async () => {
    await sut.files.put(`$INPUT/${EXAMPLE}`, "POSTGRES_PASSWORD=\n");
  });

  await given('a "deploy/compose/.env" with "POSTGRES_PASSWORD=mine"', async () => {
    await sut.files.put(`$INPUT/${ENV}`, "POSTGRES_PASSWORD=mine\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf init"', async () => {
    run = await sut.cli(["init"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"deploy/compose/.env" still has "POSTGRES_PASSWORD=mine"', async () => {
    expect(await sut.files.read(`$INPUT/${ENV}`)).toBe("POSTGRES_PASSWORD=mine\n");
  });

  await then('the output contains "deploy/compose/.env exists: kept it"', async () => {
    expect(run.stdout).toContain("deploy/compose/.env exists: kept it");
  });
});
