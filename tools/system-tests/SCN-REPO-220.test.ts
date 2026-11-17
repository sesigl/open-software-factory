import { type CliResult, scenario } from "@opensoftware/testkit";
import { deployFeature } from "./released.ts";

scenario("SCN-REPO-220", async ({ sut, given, when, then }) => {
  await given(
    '"deploy/features/compose.feature" with the implemented scenarios "SCN-DIST-001" and "SCN-DIST-002", the planned "SCN-DIST-003" and the implemented "SCN-DIST-004" with the tag "@images=commit"',
    async () => {
      await deployFeature(sut, "compose.feature", [
        ["SCN-DIST-001", "@status=implemented"],
        ["SCN-DIST-002", "@status=implemented @shared=compose-profile"],
        ["SCN-DIST-003", "@status=planned"],
        ["SCN-DIST-004", "@status=implemented @images=commit"],
      ]);
    },
  );

  await given('"deploy/features/helm.feature" with the implemented scenario "SCN-DIST-005"', async () => {
    await deployFeature(sut, "helm.feature", [["SCN-DIST-005", "@status=implemented"]]);
  });

  let run: CliResult;
  await when('the developer runs "osf released-images scenarios"', async () => {
    run = await sut.cli(["released-images", "scenarios"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output is the lines "system-tests/SCN-DIST-001.test.ts" and "system-tests/SCN-DIST-002.test.ts"',
    async () => {
      expect(run.stdout).toBe("system-tests/SCN-DIST-001.test.ts\nsystem-tests/SCN-DIST-002.test.ts\n");
    },
  );
});
