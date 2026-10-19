import { scenario } from "@opensoftware/testkit";
import { layeredModule } from "./repo.ts";

scenario("SCN-REPO-027", async ({ sut, given, when, then }) => {
  await given(
    'a module "demo" whose architecture.json lists the layer "cli" with "src/cli/" above the layer "domain" with "src/domain/"',
    async () => {
      for (const [path, content] of Object.entries(layeredModule())) await sut.files.put(`$INPUT/${path}`, content);
    },
  );

  await given('the file "modules/demo/src/util.ts"', async () => {
    await sut.files.put("$INPUT/modules/demo/src/util.ts", "export const util = 1;\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ARCH"', async () => {
    run = await sut.cli(["check", "ARCH"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "ARCH modules/demo/src/util.ts:1 is in no layer of modules/demo/architecture.json"',
    async () => {
      expect(run.stdout).toContain("ARCH modules/demo/src/util.ts:1 is in no layer of modules/demo/architecture.json");
    },
  );
});
