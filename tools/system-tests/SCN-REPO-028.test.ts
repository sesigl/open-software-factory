import { scenario } from "@opensoftware/testkit";
import { DEMO_PACKAGE } from "./repo.ts";

scenario("SCN-REPO-028", async ({ sut, given, when, then }) => {
  await given('a module "demo" with the file "modules/demo/src/index.ts" and no architecture.json', async () => {
    await sut.files.put("$INPUT/modules/demo/package.json", DEMO_PACKAGE);
    await sut.files.put("$INPUT/modules/demo/src/index.ts", "export const value = 1;\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ARCH"', async () => {
    run = await sut.cli(["check", "ARCH"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "ARCH modules/demo/package.json:1 has no architecture.json"', async () => {
    expect(run.stdout).toContain("ARCH modules/demo/package.json:1 has no architecture.json");
  });
});
