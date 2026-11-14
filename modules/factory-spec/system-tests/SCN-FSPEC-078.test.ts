import { scenario } from "@opensoftware/testkit";
import { putShared, resolved } from "./edit.ts";

scenario("SCN-FSPEC-078", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml with comments whose agents "triage", "spec" and "review" share the sandbox of "triage" through the anchor "&sandbox"',
    async () => {
      await putShared(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit remove-egress spec github.com"', async () => {
    run = await sut.cli(["edit", "remove-egress", "spec", "github.com"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"factory resolve" of the output gives "spec" the egress hosts "litellm"', async () => {
    const { agents } = await resolved(sut, run);
    expect(agents.spec?.sandbox?.egress).toEqual(["litellm"]);
  });

  await then(
    '"factory resolve" of the output gives "triage" and "review" the egress hosts "litellm" and "github.com"',
    async () => {
      const { agents } = await resolved(sut, run);
      for (const name of ["triage", "review"]) expect(agents[name]?.sandbox?.egress).toEqual(["litellm", "github.com"]);
    },
  );
});
