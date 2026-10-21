import { scenario } from "@opensoftware/testkit";
import { DEMO_PACKAGE } from "./repo.ts";

scenario("SCN-REPO-047", async ({ sut, given, when, then }) => {
  await given('a module "demo" with a source file and an AGENTS.md without "Quality limits"', async () => {
    await sut.files.put("$INPUT/modules/demo/package.json", DEMO_PACKAGE);
    await sut.files.put("$INPUT/modules/demo/AGENTS.md", "# demo\n\n## Budget\n\n- System tests: 10 seconds.\n");
    await sut.files.put("$INPUT/modules/demo/src/run.ts", "export const run = 1;\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check DUP"', async () => {
    run = await sut.cli(["check", "DUP"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    `the output contains 'DUP modules/demo/AGENTS.md:1 no "Duplication: at most N%" limit for modules/demo'`,
    async () => {
      expect(run.stdout).toContain('DUP modules/demo/AGENTS.md:1 no "Duplication: at most N%" limit for modules/demo');
    },
  );
});
