import { scenario } from "@opensoftware/testkit";
import { putTemplate, READS, SHOWS, templateOf } from "./templates.ts";

scenario("SCN-REPO-142", async ({ sut, given, when, then }) => {
  await given(
    'the module "demo" whose template "src/web/pages/runs.astro" imports a component and a type, reads the page\'s data and its status, maps the runs and switches on a value',
    async () => {
      await putTemplate(sut, templateOf(SHOWS, READS));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check TEMPLATE"', async () => {
    run = await sut.cli(["check", "TEMPLATE"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "TEMPLATE ok"', async () => {
    expect(run.stdout).toContain("TEMPLATE ok");
  });
});
