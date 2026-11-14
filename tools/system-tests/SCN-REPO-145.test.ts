import { scenario } from "@opensoftware/testkit";
import { putTemplate, READS, SHOWS, templateOf } from "./templates.ts";

scenario("SCN-REPO-145", async ({ sut, given, when, then }) => {
  await given(
    'the module "demo" whose template "src/web/pages/runs.astro" imports a type of "src/commands/serve.ts"',
    async () => {
      await putTemplate(sut, templateOf(['import type { Serve } from "../../commands/serve.ts";', ...SHOWS], READS));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check TEMPLATE"', async () => {
    run = await sut.cli(["check", "TEMPLATE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TEMPLATE modules/demo/src/web/pages/runs.astro:2 imports ../../commands/serve.ts of the layer commands, above its layer templates"',
    async () => {
      expect(run.stdout).toContain(
        "TEMPLATE modules/demo/src/web/pages/runs.astro:2 imports ../../commands/serve.ts of the layer commands, above its layer templates",
      );
    },
  );
});
