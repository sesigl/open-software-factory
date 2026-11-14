import { scenario } from "@opensoftware/testkit";
import { realizingModule, VISION, visionFeature } from "./vision.ts";

scenario("SCN-REPO-129", async ({ sut, given, when, then }) => {
  await given(
    'a vision scenario "SCN-FACTORY-DEMO-001" with the status "implemented" and a vision scenario "SCN-FACTORY-DEMO-002" with the status "implemented"',
    async () => {
      await sut.files.put(`$INPUT/${VISION}`, visionFeature("implemented", "implemented"));
    },
  );

  await given(
    'the implemented module scenario "SCN-DEMO-001" and the planned module scenario "SCN-DEMO-002" realize "SCN-FACTORY-DEMO-001"',
    async () => {
      const files = realizingModule("implemented", "planned", "SCN-FACTORY-DEMO-001");
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
    'the output contains "VISION docs/vision/software-factory.feature:5 SCN-FACTORY-DEMO-001 is implemented, but the scenarios that realize it make it planned: set @status=planned"',
    async () => {
      expect(run.stdout).toContain(
        "VISION docs/vision/software-factory.feature:5 SCN-FACTORY-DEMO-001 is implemented, but the scenarios that realize it make it planned: set @status=planned",
      );
    },
  );

  await then(
    'the output contains "VISION docs/vision/software-factory.feature:9 SCN-FACTORY-DEMO-002 is implemented, but the scenarios that realize it make it planned: set @status=planned"',
    async () => {
      expect(run.stdout).toContain(
        "VISION docs/vision/software-factory.feature:9 SCN-FACTORY-DEMO-002 is implemented, but the scenarios that realize it make it planned: set @status=planned",
      );
    },
  );
});
