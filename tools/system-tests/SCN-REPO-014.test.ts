import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST, demoModule, junit } from "./repo.ts";

scenario("SCN-REPO-014", async ({ sut, given, when, then }) => {
  await given('a repository whose module "demo" has a budget of 10 seconds', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(`$INPUT/${path}`, content);
    await sut.files.put(
      "$INPUT/modules/demo/AGENTS.md",
      "# demo\n\n## Budget\n\n- System tests: 10 seconds in total on the CI runner.\n",
    );
  });

  await given('a JUnit report in which the system tests of "demo" took 12.5 seconds', async () => {
    await sut.files.put("$INPUT/reports/junit/demo.xml", junit([{ file: DEMO_TEST, id: "SCN-DEMO-001", time: 12.5 }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BUDGET"', async () => {
    run = await sut.cli(["check", "BUDGET"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "BUDGET modules/demo/AGENTS.md"', async () => {
    expect(run.stdout).toContain("BUDGET modules/demo/AGENTS.md");
  });

  await then('the output contains "12.5 s"', async () => {
    expect(run.stdout).toContain("12.5 s");
  });
});
