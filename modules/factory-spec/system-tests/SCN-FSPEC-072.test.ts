import { scenario } from "@opensoftware/testkit";
import { factoryWithAccess } from "./access.ts";

scenario("SCN-FSPEC-072", async ({ sut, given, when, then }) => {
  await given('a valid factory.yaml and beside it an access.yaml with the text "people: [ada"', async () => {
    await factoryWithAccess(sut, {});
    await sut.files.put("$INPUT/access.yaml", "people: [ada");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output starts with "access.yaml: " and names the YAML problem, and then "factory.yaml: 1 problems"',
    async () => {
      const lines = run.stdout.trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatch(/^access\.yaml: .*flow/i);
      expect(lines[1]).toBe("factory.yaml: 1 problems");
    },
  );
});
