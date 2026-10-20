import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { product } from "./capture.ts";
import { manifestOf } from "./reports.ts";

scenario("SCN-PROOF-042", async ({ sut, fakes, given, when, then }) => {
  let site: FakeHttp;
  await given(
    'a Git repository with one commit and a running product whose page "/checkout" shows "Pay with a card"',
    async () => {
      await sut.git.commit("init");
      site = await product(fakes, { "/checkout": "Pay with a card" });
    },
  );

  await given('the developer ran "proof capture <product>/checkout --scenario SCN-WEB-001 --out capture"', async () => {
    const capture = await sut.cli(["capture", `${site.url}/checkout`, "--scenario", "SCN-WEB-001", "--out", "capture"]);
    expect(capture.exitCode, capture.stderr).toBe(0);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof bundle --playwright capture/report.json"', async () => {
    run = await sut.cli([
      "bundle",
      "--playwright",
      "capture/report.json",
      "--repository",
      "https://github.com/acme/web",
    ]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the bundle lists the "screenshot", the "video" and the "playwright-trace" of "SCN-WEB-001"', async () => {
    const manifest = await manifestOf(sut);
    expect(manifest.scenarios).toEqual([
      {
        id: "SCN-WEB-001",
        result: "passed",
        artifacts: [
          "artifacts/SCN-WEB-001/page.png",
          "artifacts/SCN-WEB-001/video.webm",
          "artifacts/SCN-WEB-001/trace.zip",
        ],
      },
    ]);
    expect(manifest.artifacts.map((artifact) => artifact.kind)).toEqual(["screenshot", "video", "playwright-trace"]);
  });
});
