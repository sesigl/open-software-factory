import { scenario } from "@opensoftware/testkit";
import { putShared, resolved, SHARED } from "./edit.ts";

scenario("SCN-FSPEC-073", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml with comments whose agents "triage", "spec" and "review" share the secrets of "triage" through the anchor "&secrets"',
    async () => {
      await putShared(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-secret spec ref:env/LINEAR_TOKEN"', async () => {
    run = await sut.cli(["edit", "add-secret", "spec", "ref:env/LINEAR_TOKEN"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output is factory.yaml with only the line "secrets: *secrets" of "spec" changed to "secrets: [ref:env/GH_TOKEN, ref:env/CLAUDE_CODE_OAUTH_TOKEN, ref:env/LINEAR_TOKEN]"',
    async () => {
      const own = "    secrets: [ref:env/GH_TOKEN, ref:env/CLAUDE_CODE_OAUTH_TOKEN, ref:env/LINEAR_TOKEN]";
      expect(run.stdout).toBe(SHARED.replace("    secrets: *secrets", own));
    },
  );

  await then(
    '"factory resolve" of the output gives "triage" and "review" the secrets "ref:env/GH_TOKEN" and "ref:env/CLAUDE_CODE_OAUTH_TOKEN"',
    async () => {
      const { agents } = await resolved(sut, run);
      for (const name of ["triage", "review"])
        expect(agents[name]?.secrets).toEqual(["ref:env/GH_TOKEN", "ref:env/CLAUDE_CODE_OAUTH_TOKEN"]);
    },
  );
});
