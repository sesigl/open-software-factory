import { scenario } from "@opensoftware/testkit";
import { block, COMMENTS, putShared, resolved } from "./edit.ts";

scenario("SCN-FSPEC-074", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml with comments whose agents "triage", "spec" and "review" share the sandbox of "triage" through the anchor "&sandbox"',
    async () => {
      await putShared(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-egress triage registry.npmjs.org"', async () => {
    run = await sut.cli(["edit", "add-egress", "triage", "registry.npmjs.org"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"factory resolve" of the output gives "triage" the egress hosts "litellm", "github.com" and "registry.npmjs.org"',
    async () => {
      const { agents } = await resolved(sut, run);
      expect(agents.triage?.sandbox?.egress).toEqual(["litellm", "github.com", "registry.npmjs.org"]);
    },
  );

  await then(
    '"factory resolve" of the output gives "spec" and "review" the egress hosts "litellm" and "github.com"',
    async () => {
      const { agents } = await resolved(sut, run);
      for (const name of ["spec", "review"]) expect(agents[name]?.sandbox?.egress).toEqual(["litellm", "github.com"]);
    },
  );

  await then(
    'in the output "spec" holds the anchor "&sandbox" and "review" still uses it with "*sandbox"',
    async () => {
      expect(block(run.stdout, "triage")).toContain("    sandbox:\n      template: node-24\n");
      expect(block(run.stdout, "spec")).toContain("    sandbox: &sandbox\n      template: node-24\n");
      expect(block(run.stdout, "review")).toContain("    sandbox: *sandbox\n");
    },
  );

  await then("the output keeps every comment of factory.yaml", async () => {
    for (const comment of COMMENTS) expect(run.stdout).toContain(`${comment}\n`);
  });
});
