import { scenario } from "@opensoftware/testkit";
import { TEMPLATE } from "./sandbox.ts";

scenario("SCN-SDOCKER-004", async ({ sut, given, when, then }) => {
  await given('a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/../.ssh/id_ed25519"', async () => {
    const spec = { template: TEMPLATE, secrets: { LINEAR_TOKEN: "ref:file/../.ssh/id_ed25519" } };
    await sut.files.put("$INPUT/spec.json", JSON.stringify(spec));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sut.cli(["create", "spec.json"]);
  });

  await then(
    'create exits with code 2 and says that the name "../.ssh/id_ed25519" leaves OSF_SECRETS_DIR',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toContain('secret "LINEAR_TOKEN": the name "../.ssh/id_ed25519" leaves OSF_SECRETS_DIR');
    },
  );
});
