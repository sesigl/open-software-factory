import { scenario } from "@opensoftware/testkit";
import { putTriage, resolved } from "./edit.ts";

scenario("SCN-FSPEC-079", async ({ sut, given, when, then }) => {
  await given("a factory.yaml that declares no secrets provider", async () => {
    await putTriage(sut, []);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-secrets-provider openbao ^0"', async () => {
    run = await sut.cli(["edit", "add-secrets-provider", "openbao", "^0"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"factory resolve" of the output declares the secrets provider "openbao" at "^0" and still the harness "claude-code" at "^2"',
    async () => {
      const { providers } = await resolved(sut, run);
      expect(providers).toEqual({ harness: { "claude-code": "^2" }, secrets: { openbao: "^0" } });
    },
  );
});
