import { scenario } from "@opensoftware/testkit";
import { TEMPLATE } from "./sandbox.ts";

scenario("SCN-SDOCKER-002", async ({ sut, given, when, then }) => {
  await given('a sandbox spec with the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"', async () => {
    const spec = { template: TEMPLATE, secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" } };
    await sut.files.put("$INPUT/spec.json", JSON.stringify(spec));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sut.cli(["create", "spec.json"]);
  });

  await then('create exits with code 2 and says that the provider "openbao" is not supported', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain(
      'sandbox-docker: secret "LINEAR_TOKEN": the provider "openbao" is not supported; sandbox-docker supports "file"',
    );
  });
});
