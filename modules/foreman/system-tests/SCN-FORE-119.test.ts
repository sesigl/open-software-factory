import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, readmeFiles } from "./foreman.ts";

scenario("SCN-FORE-119", async ({ sut, fakes, given, when, then }) => {
  await given('the README\'s "checks/factory.yaml" whose stage "ship" has "wait: true" and no checks', async () => {
    const factory = (readmeFiles(fakes)["checks/factory.yaml"] as string).replace(
      "    checks: [verify]\n",
      "    wait: true\n",
    );
    expect(factory).not.toContain("checks:");
    await sut.files.put("$INPUT/factory.yaml", factory);
    await sut.git.commit("a stage that only waits for nothing");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "factory.yaml: /workflow/2/wait: a stage that only waits names checks, the evidence \\"required\\" or a gate"',
    async () => {
      expect(run.stderr).toContain(
        'factory.yaml: /workflow/2/wait: a stage that only waits names checks, the evidence "required" or a gate',
      );
    },
  );
});
