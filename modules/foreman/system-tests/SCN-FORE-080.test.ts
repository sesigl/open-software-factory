import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, evidenceFactory } from "./foreman.ts";

const PROBLEM =
  'factory.yaml: /workflow/2/evidence: name one forge adapter under providers.forge: the stage waits for the check "proof"';

scenario("SCN-FORE-080", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the README\'s "checks/factory.yaml" whose stage "ship" has "evidence: required", without "providers.forge"',
    async () => {
      const factory = evidenceFactory(fakes).replace('  forge:\n    github: "^0"\n', "");
      expect(factory).not.toContain("forge:");
      await sut.files.put("$INPUT/factory.yaml", factory);
      await sut.git.commit("a factory with evidence and no forge adapter");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "factory.yaml: /workflow/2/evidence: name one forge adapter under providers.forge: the stage waits for the check \\"proof\\""',
    async () => {
      expect(run.stderr).toContain(PROBLEM);
    },
  );
});
