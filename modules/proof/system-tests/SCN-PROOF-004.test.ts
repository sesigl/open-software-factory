import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-004", async ({ sut, given, when, then }) => {
  await given(
    'a Playwright report whose test "SCN-WEB-001 checkout" has the screenshot "checkout.png" and the video "video.webm"',
    async () => {
      await putPlaywright(sut, [
        {
          title: "SCN-WEB-001 checkout",
          attachments: [
            { name: "screenshot", contentType: "image/png", path: "test-results/checkout/checkout.png" },
            { name: "video", contentType: "video/webm", path: "test-results/checkout/video.webm" },
          ],
        },
      ]);
      await sut.git.commit("init");
    },
  );

  await when('the developer runs "proof bundle --playwright report.json"', async () => {
    const run = await sut.cli(["bundle", "--playwright", "report.json", "--repository", "https://github.com/acme/web"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the bundle lists "artifacts/SCN-WEB-001/checkout.png" as "screenshot" with the media type "image/png"',
    async () => {
      expect((await manifestOf(sut)).artifacts).toContainEqual(
        expect.objectContaining({
          path: "artifacts/SCN-WEB-001/checkout.png",
          kind: "screenshot",
          mediaType: "image/png",
        }),
      );
    },
  );

  await then(
    'the bundle lists "artifacts/SCN-WEB-001/video.webm" as "video" with the media type "video/webm"',
    async () => {
      expect((await manifestOf(sut)).artifacts).toContainEqual(
        expect.objectContaining({ path: "artifacts/SCN-WEB-001/video.webm", kind: "video", mediaType: "video/webm" }),
      );
    },
  );

  await then("each artifact in the bundle has the SHA-256 and the size of its file", async () => {
    // The files hold "screenshot of SCN-WEB-001 checkout" and "video of SCN-WEB-001 checkout" (putPlaywright).
    expect((await manifestOf(sut)).artifacts.map(({ path, sha256, bytes }) => ({ path, sha256, bytes }))).toEqual([
      {
        path: "artifacts/SCN-WEB-001/checkout.png",
        sha256: "5328f417f2ce67c5718d46f226ad67e71611ab3b0488c8f57eec80e82aa858b0",
        bytes: 34,
      },
      {
        path: "artifacts/SCN-WEB-001/video.webm",
        sha256: "4951e3b1311a32b3996573d6d1322cc1984219366c746f4a9a1bd43d0b1e00f7",
        bytes: 29,
      },
    ]);
  });
});
