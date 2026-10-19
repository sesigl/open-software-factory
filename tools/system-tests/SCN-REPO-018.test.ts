import { scenario } from "@opensoftware/testkit";
import { acceptedAdr } from "./repo.ts";

scenario("SCN-REPO-018", async ({ sut, given, when, then }) => {
  let base = "";
  await given("a base commit without dependencies", async () => {
    await sut.files.put("modules/demo/package.json", '{\n  "name": "@opensoftware/demo",\n  "version": "0.1.0"\n}\n');
    await sut.files.put("docs/decisions/0001-demo.md", acceptedAdr("0001", "the module `modules/demo`"));
    base = await sut.git.commit("base");
  });

  await given('a change that adds the dependency "left-pad" to "modules/demo/package.json"', async () => {
    const manifest = { name: "@opensoftware/demo", version: "0.1.0", dependencies: { "left-pad": "1.3.0" } };
    await sut.files.put("modules/demo/package.json", `${JSON.stringify(manifest, null, 2)}\n`);
  });

  await given('the only ADR that names "left-pad" is proposed', async () => {
    await sut.files.put("docs/decisions/0002-left-pad.md", acceptedAdr("0002", "`left-pad`", "proposed"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ADR" against the base commit', async () => {
    run = await sut.cli(["check", "ADR"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "ADR modules/demo/package.json"', async () => {
    expect(run.stdout).toContain("ADR modules/demo/package.json");
  });

  await then('the output contains "left-pad"', async () => {
    expect(run.stdout).toContain("left-pad");
  });
});
