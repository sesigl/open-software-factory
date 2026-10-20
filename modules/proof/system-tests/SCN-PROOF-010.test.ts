import { scenario } from "@opensoftware/testkit";
import { junitReport, manifestOf } from "./reports.ts";

scenario("SCN-PROOF-010", async ({ sut, given, when, then }) => {
  await given(
    'a JUnit report with a passed test case that has the property "scenario" "SCN-API-001" and a failed one with "SCN-API-002"',
    async () => {
      await sut.files.put(
        "$INPUT/report.xml",
        junitReport([
          { name: "creates a customer", scenario: "SCN-API-001" },
          { name: "updates a customer", scenario: "SCN-API-002", result: "failure" },
        ]),
      );
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof bundle --junit report.xml"', async () => {
    run = await sut.cli(["bundle", "--junit", "report.xml", "--repository", "https://github.com/acme/web"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the bundle lists the scenario "SCN-API-001" with the result "passed" and the artifact "junit/report.xml"',
    async () => {
      expect((await manifestOf(sut)).scenarios).toContainEqual({
        id: "SCN-API-001",
        result: "passed",
        artifacts: ["junit/report.xml"],
      });
    },
  );

  await then(
    'the bundle lists the scenario "SCN-API-002" with the result "failed" and the artifact "junit/report.xml"',
    async () => {
      expect((await manifestOf(sut)).scenarios).toContainEqual({
        id: "SCN-API-002",
        result: "failed",
        artifacts: ["junit/report.xml"],
      });
    },
  );

  await then('the bundle lists "junit/report.xml" as "junit" with the media type "application/xml"', async () => {
    expect((await manifestOf(sut)).artifacts).toEqual([
      expect.objectContaining({ path: "junit/report.xml", kind: "junit", mediaType: "application/xml" }),
    ]);
  });
});
