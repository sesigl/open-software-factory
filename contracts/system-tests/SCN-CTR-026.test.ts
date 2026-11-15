import { scenario } from "@opensoftware/testkit";

const REQUIRED = ["/iss", "/sub", "/role", "/aud", "/iat", "/exp", "/method", "/path", "/bodyDigest"];

scenario("SCN-CTR-026", async ({ sut, given, when, then }) => {
  await given('a person proof "proof.json" that is an empty object', async () => {
    await sut.files.put("$INPUT/proof.json", "{}");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate person-proof proof.json"', async () => {
    run = await sut.cli(["validate", "person-proof", "proof.json"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output names "/iss", "/sub", "/role", "/aud", "/iat", "/exp", "/method", "/path" and "/bodyDigest" each as "missing required field"',
    async () => {
      const lines = run.stdout.trim().split("\n");
      expect(lines).toEqual(REQUIRED.map((path) => `proof.json ${path}: missing required field`));
    },
  );
});
