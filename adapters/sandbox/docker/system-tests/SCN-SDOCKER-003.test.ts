import { scenario } from "@opensoftware/testkit";
import { TEMPLATE } from "./sandbox.ts";

scenario("SCN-SDOCKER-003", async ({ sut, given, when, then }) => {
  await given(
    'a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/linear-token" and no file "linear-token"',
    async () => {
      const spec = { template: TEMPLATE, secrets: { LINEAR_TOKEN: "ref:file/linear-token" } };
      await sut.files.put("$INPUT/spec.json", JSON.stringify(spec));
      await sut.files.put("$INPUT/secrets/other-token", "x");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sut.cli(["create", "spec.json"], { env: { OSF_SECRETS_DIR: sut.files.path("$INPUT/secrets") } });
  });

  await then(
    'create exits with code 2 and says that the secret "LINEAR_TOKEN" has no file "linear-token"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toContain('sandbox-docker: secret "LINEAR_TOKEN" has no file "linear-token"');
    },
  );
});
