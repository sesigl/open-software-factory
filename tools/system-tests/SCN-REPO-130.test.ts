import { scenario } from "@opensoftware/testkit";
import { realizingModule, VISION, visionFeature } from "./vision.ts";

scenario("SCN-REPO-130", async ({ sut, given, when, then }) => {
  await given(
    'a vision scenario "SCN-FACTORY-DEMO-001" with the status "implemented" and a vision scenario "SCN-FACTORY-DEMO-002" with the status "planned"',
    async () => {
      await sut.files.put(`$INPUT/${VISION}`, visionFeature("implemented", "planned"));
    },
  );

  await given(
    'the implemented module scenario "SCN-DEMO-001" and the deprecated module scenario "SCN-DEMO-002" realize "SCN-FACTORY-DEMO-001"',
    async () => {
      const files = realizingModule("implemented", "deprecated", "SCN-FACTORY-DEMO-001");
      for (const [path, content] of Object.entries(files)) await sut.files.put(`$INPUT/${path}`, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check VISION"', async () => {
    run = await sut.cli(["check", "VISION"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "VISION ok"', async () => {
    expect(run.stdout).toContain("VISION ok");
  });
});
