import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-032", async ({ sut, given, when, then }) => {
  await given(
    'a Playwright report whose test "SCN-WEB-001 checkout" has the attachment "console.txt" of the type "text/plain"',
    async () => {
      await putPlaywright(sut, [
        {
          title: "SCN-WEB-001 checkout",
          attachments: [{ name: "console", contentType: "text/plain", path: "test-results/console.txt" }],
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
    'the bundle lists "artifacts/SCN-WEB-001/console.txt" as "other" with the media type "text/plain"',
    async () => {
      expect((await manifestOf(sut)).artifacts).toEqual([
        expect.objectContaining({ path: "artifacts/SCN-WEB-001/console.txt", kind: "other", mediaType: "text/plain" }),
      ]);
    },
  );
});
