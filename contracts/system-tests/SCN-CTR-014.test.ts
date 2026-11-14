import { scenario } from "@opensoftware/testkit";

const ALLOWED = 'access.yaml /people/0/role: must be one of "member", "factory-engineer", "admin"';

scenario("SCN-CTR-014", async ({ sut, given, when, then }) => {
  await given('an access file "access.yaml" with "ada@acme.dev" as "owner"', async () => {
    await sut.files.put("$INPUT/access.yaml", "version: 1\npeople:\n  - email: ada@acme.dev\n    role: owner\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate access access.yaml"', async () => {
    run = await sut.cli(["validate", "access", "access.yaml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "access.yaml /people/0/role: must be one of \\"member\\", \\"factory-engineer\\", \\"admin\\""',
    async () => {
      expect(run.stdout).toContain(ALLOWED);
    },
  );
});
