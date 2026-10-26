import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, readmeFiles } from "./foreman.ts";

scenario("SCN-FORE-026", async ({ sut, fakes, given, when, then }) => {
  await given('the README\'s "factory.yaml" and its prompts in a folder outside any Git repository', async () => {
    const files = readmeFiles(fakes);
    for (const name of ["factory.yaml", "agents/plan.md", "agents/implement.md"])
      await sut.files.put(`$OUTPUT/factory/${name}`, files[name] as string);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve" with "FOREMAN_FACTORY" set to that "factory.yaml"', async () => {
    run = await sut.cli(["serve"], {
      env: { FOREMAN_API_TOKEN: API_TOKEN, FOREMAN_FACTORY: sut.files.path("$OUTPUT/factory/factory.yaml") },
    });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the output contains "factory.yaml: commit it in a Git repository"', async () => {
    expect(run.stderr).toContain("factory.yaml: commit it in a Git repository");
  });
});
