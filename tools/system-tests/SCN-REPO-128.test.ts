import { scenario } from "@opensoftware/testkit";
import { realizingModule, VISION, visionFeature } from "./vision.ts";

scenario("SCN-REPO-128", async ({ sut, given, when, then }) => {
  await given(
    'a vision scenario "SCN-FACTORY-DEMO-001" with the status "planned" and a vision scenario "SCN-FACTORY-DEMO-002" with the status "planned"',
    async () => {
      await sut.files.put(`$INPUT/${VISION}`, visionFeature("planned", "planned"));
    },
  );

  await given(
    'the implemented module scenarios "SCN-DEMO-001" and "SCN-DEMO-002" realize "SCN-FACTORY-DEMO-001"',
    async () => {
      const files = realizingModule("implemented", "implemented", "SCN-FACTORY-DEMO-001");
      for (const [path, content] of Object.entries(files)) await sut.files.put(`$INPUT/${path}`, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check VISION"', async () => {
    run = await sut.cli(["check", "VISION"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "VISION docs/vision/software-factory.feature:5 SCN-FACTORY-DEMO-001 is planned, but the scenarios that realize it make it implemented: set @status=implemented"',
    async () => {
      expect(run.stdout).toContain(
        "VISION docs/vision/software-factory.feature:5 SCN-FACTORY-DEMO-001 is planned, but the scenarios that realize it make it implemented: set @status=implemented",
      );
    },
  );

  await then('the output does not name "SCN-FACTORY-DEMO-002"', async () => {
    expect(run.stdout).not.toContain("SCN-FACTORY-DEMO-002");
  });
});
