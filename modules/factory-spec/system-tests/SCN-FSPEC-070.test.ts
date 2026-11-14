import { scenario } from "@opensoftware/testkit";
import { factoryWithAccess } from "./access.ts";

scenario("SCN-FSPEC-070", async ({ sut, given, when, then }) => {
  await given('a valid factory.yaml and beside it an access.yaml with "ada@acme.dev" as "owner"', async () => {
    await factoryWithAccess(sut, { "ada@acme.dev": "owner" });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "access.yaml /people/0/role: must be one of \\"member\\", \\"factory-engineer\\", \\"admin\\"" and then "factory.yaml: 1 problems"',
    async () => {
      expect(run.stdout).toBe(
        'access.yaml /people/0/role: must be one of "member", "factory-engineer", "admin"\nfactory.yaml: 1 problems\n',
      );
    },
  );
});
