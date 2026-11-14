import { scenario } from "@opensoftware/testkit";
import { factoryWithAccess, putAccess } from "./access.ts";

scenario("SCN-FSPEC-071", async ({ sut, given, when, then }) => {
  await given('a valid factory.yaml and beside it an access.yaml with "varun@acme.dev" as "member" only', async () => {
    await factoryWithAccess(sut, { "varun@acme.dev": "member" });
  });

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when(
    'the factory engineer runs "factory lint", then adds "ada@acme.dev" as "admin" and runs it again',
    async () => {
      const first = await sut.cli(["lint"]);
      await putAccess(sut, { "varun@acme.dev": "member", "ada@acme.dev": "admin" });
      runs = [first, await sut.cli(["lint"])];
    },
  );

  await then(
    'the first run exits with code 1 and prints "access.yaml: no person has the role admin, so nobody can change who signs in"',
    async () => {
      expect(runs[0]?.exitCode).toBe(1);
      expect(runs[0]?.stdout).toBe(
        "access.yaml: no person has the role admin, so nobody can change who signs in\nfactory.yaml: 1 problems\n",
      );
    },
  );

  await then('the second run exits with code 0 and prints "factory.yaml: no problems"', async () => {
    expect([runs[1]?.exitCode, runs[1]?.stdout]).toEqual([0, "factory.yaml: no problems\n"]);
  });
});
