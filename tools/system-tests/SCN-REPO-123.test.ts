import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST, demoModule, junit } from "./repo.ts";

/** The demo module in a workspace, with its system tests run by "testkit timed". */
const TIMED_PACKAGE = `${JSON.stringify(
  {
    name: "@opensoftware/demo",
    version: "0.1.0",
    type: "module",
    scripts: { "test:system": "testkit timed vitest run" },
  },
  null,
  2,
)}\n`;

scenario("SCN-REPO-123", async ({ sut, given, when, then }) => {
  await given(
    'a repository whose module "demo" has a budget of 10 seconds and runs its system tests with "testkit timed"',
    async () => {
      for (const [path, content] of Object.entries(demoModule())) await sut.files.put(`$INPUT/${path}`, content);
      await sut.files.put("$INPUT/pnpm-workspace.yaml", "packages:\n  - modules/*\n");
      await sut.files.put("$INPUT/modules/demo/package.json", TIMED_PACKAGE);
      await sut.files.put(
        "$INPUT/modules/demo/AGENTS.md",
        "# demo\n\n## Budget\n\n- System tests: 10 seconds in total on the reference runner.\n",
      );
    },
  );

  await given(
    'a JUnit report in which the system tests of "demo" took 12.5 seconds, on a runner whose slowdown was 1.5',
    async () => {
      await sut.files.put(
        "$INPUT/reports/junit/demo.xml",
        junit([{ file: DEMO_TEST, id: "SCN-DEMO-001", time: 12.5 }]),
      );
      await sut.files.put(
        "$INPUT/reports/speed/demo.json",
        JSON.stringify({ benchmarkMs: [1500, 1500], referenceMs: 1000, slowdown: 1.5 }),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BUDGET"', async () => {
    run = await sut.cli(["check", "BUDGET"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });
});
