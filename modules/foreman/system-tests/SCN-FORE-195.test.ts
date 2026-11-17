import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, readmeFiles } from "./foreman.ts";

scenario<"stage" | "entry" | "at" | "says">("SCN-FORE-195", async ({ sut, fakes, given, when, then, example }) => {
  await given(
    'the README\'s "checks/factory.yaml" with the stage "verify" before "ship" that has "wait: true" and the checks ["verify"], whose stage "<stage>" has "<entry>"',
    async () => {
      const factory = (readmeFiles(fakes)["checks/factory.yaml"] as string)
        .replace("  - stage: ship\n", "  - stage: verify\n    wait: true\n    checks: [verify]\n  - stage: ship\n")
        .replace(`  - stage: ${example.stage}\n`, `  - stage: ${example.stage}\n    ${example.entry}\n`);
      expect(factory).toContain(`  - stage: ${example.stage}\n    ${example.entry}\n`);
      expect(factory).toContain("  - stage: verify\n");
      await sut.files.put("$INPUT/factory.yaml", factory);
      // The prompts the factory names, so that only the stage's rework can stop the server.
      for (const [path, text] of Object.entries(readmeFiles(fakes)))
        if (path.startsWith("agents/")) await sut.files.put(`$INPUT/${path}`, text);
      await sut.git.commit("a stage that sends a failed check back");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the output contains "factory.yaml: <at>: <says>"', async () => {
    expect(run.stderr).toContain(`factory.yaml: ${example.at}: ${example.says}`);
  });
});
