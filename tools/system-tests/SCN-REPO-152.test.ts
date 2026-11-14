import { scenario } from "@opensoftware/testkit";
import { putTemplate, READS, SHOWS, templateOf } from "./templates.ts";

scenario("SCN-REPO-152", async ({ sut, given, when, then }) => {
  await given(
    'the module "demo" whose template "src/web/pages/runs.astro" imports "@opensoftware/ui/components/Shell.astro" and "@opensoftware/ui/tokens.css"',
    async () => {
      const head = [
        'import "@opensoftware/ui/tokens.css";',
        'import Shell from "@opensoftware/ui/components/Shell.astro";',
        ...SHOWS,
      ];
      await putTemplate(sut, templateOf(head, READS));
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
