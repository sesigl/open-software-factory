import { scenario } from "@opensoftware/testkit";

scenario("SCN-CTR-013", async ({ sut, given, when, then }) => {
  await given(
    'an access file "access.yaml" with "ada@acme.dev" as "admin" and "varun@acme.dev" as "member"',
    async () => {
      await sut.files.put(
        "$INPUT/access.yaml",
        "version: 1\npeople:\n  - email: ada@acme.dev\n    name: Ada\n    role: admin\n  - email: varun@acme.dev\n    role: member\n",
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate access access.yaml"', async () => {
    run = await sut.cli(["validate", "access", "access.yaml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "access.yaml: valid access"', async () => {
    expect(run.stdout).toContain("access.yaml: valid access");
  });
});
