import { scenario } from "@opensoftware/testkit";
import { ENV, EXAMPLE } from "./setup.ts";

const FACTORY = "name: reference\n";
const GROUPS = '{ "maintainers": ["slack:U0EXAMPLE"] }\n';

scenario("SCN-REPO-134", async ({ sut, given, when, then }) => {
  await given('a "deploy/compose/.env.example" with "FACTORY_DIR="', async () => {
    await sut.files.put(`$INPUT/${EXAMPLE}`, "FACTORY_DIR=\n");
  });

  await given('a reference factory in "deploy/compose/factory/" with "factory.yaml" and "groups.json"', async () => {
    await sut.files.put("$INPUT/deploy/compose/factory/factory.yaml", FACTORY);
    await sut.files.put("$INPUT/deploy/compose/factory/groups.json", GROUPS);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf init --factory team/factory"', async () => {
    run = await sut.cli(["init", "--factory", "team/factory"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"team/factory/factory.yaml" and "team/factory/groups.json" are copies of the reference factory\'s',
    async () => {
      expect(await sut.files.read("$INPUT/team/factory/factory.yaml")).toBe(FACTORY);
      expect(await sut.files.read("$INPUT/team/factory/groups.json")).toBe(GROUPS);
    },
  );

  await then('"deploy/compose/.env" has the line "FACTORY_DIR=../../team/factory"', async () => {
    expect((await sut.files.read(`$INPUT/${ENV}`)).split("\n")).toContain("FACTORY_DIR=../../team/factory");
  });
});
