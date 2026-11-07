import { scenario } from "@opensoftware/testkit";
import { manifestOf } from "./reports.ts";

const shot = (folder: string) => ({
  name: "screenshot",
  contentType: "image/png",
  path: `test-results/${folder}/screenshot.png`,
});
const log = (folder: string) => ({ name: "stdout", contentType: "text/plain", path: `test-results/${folder}/stdout` });

scenario("SCN-PROOF-056", async ({ sut, given, when, then }) => {
  await given(
    'a Playwright report with the suite "SCN-WEB-001 checkout" inside the suite "web.spec.ts", whose test has the screenshot "screenshot.png" from 3 folders over 2 results, the file "stdout" from 2 folders and an attachment without a file',
    async () => {
      const report = {
        suites: [
          {
            title: "web.spec.ts",
            suites: [
              {
                title: "SCN-WEB-001 checkout",
                specs: [
                  {
                    title: "pays by card",
                    tests: [
                      {
                        status: "expected",
                        results: [
                          { status: "failed", attachments: [shot("a"), shot("b"), log("a")] },
                          {
                            status: "passed",
                            attachments: [shot("c"), log("b"), { name: "note", contentType: "text/plain", body: "x" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      await sut.files.put("$INPUT/report.json", JSON.stringify(report));
      for (const file of [shot("a"), shot("b"), shot("c"), log("a"), log("b")]) {
        await sut.files.put(`$INPUT/${file.path}`, `${file.name} in ${file.path}`);
      }
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof bundle --playwright report.json"', async () => {
    run = await sut.cli(["bundle", "--playwright", "report.json", "--repository", "https://github.com/acme/web"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the bundle lists the scenario "SCN-WEB-001" with the artifacts "artifacts/SCN-WEB-001/screenshot.png", "artifacts/SCN-WEB-001/screenshot-2.png", "artifacts/SCN-WEB-001/screenshot-3.png", "artifacts/SCN-WEB-001/stdout" and "artifacts/SCN-WEB-001/stdout-2"',
    async () => {
      const manifest = await manifestOf(sut);
      expect(manifest.scenarios).toEqual([
        {
          id: "SCN-WEB-001",
          result: "passed",
          artifacts: [
            "artifacts/SCN-WEB-001/screenshot.png",
            "artifacts/SCN-WEB-001/screenshot-2.png",
            "artifacts/SCN-WEB-001/stdout",
            "artifacts/SCN-WEB-001/screenshot-3.png",
            "artifacts/SCN-WEB-001/stdout-2",
          ],
        },
      ]);
    },
  );
});
