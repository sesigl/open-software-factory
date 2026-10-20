import { scenario } from "@opensoftware/testkit";
import { capturedScenario } from "./capture.ts";

scenario("SCN-PROOF-039", async ({ sut, given, when, then }) => {
  await given(
    'a folder "mcp" with the files "page-1.png", "videos/checkout.webm", "traces/session.zip" and "notes.md"',
    async () => {
      await sut.files.put("$INPUT/mcp/page-1.png", "screenshot of the checkout");
      await sut.files.put("$INPUT/mcp/videos/checkout.webm", "video of the checkout");
      await sut.files.put("$INPUT/mcp/traces/session.zip", "PK trace of the checkout");
      await sut.files.put("$INPUT/mcp/notes.md", "# Session\n");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof capture --from mcp --scenario SCN-WEB-002"', async () => {
    run = await sut.cli(["capture", "--from", "mcp", "--scenario", "SCN-WEB-002"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the capture report lists "SCN-WEB-002" as "expected" with a "screenshot", a "video" and a "trace"',
    async () => {
      expect(await capturedScenario(sut, "SCN-WEB-002")).toEqual({
        status: "expected",
        names: ["screenshot", "trace", "video"],
      });
    },
  );

  await then(
    '"$OUTPUT/capture/SCN-WEB-002" holds "page-1.png", "videos/checkout.webm" and "traces/session.zip" but not "notes.md"',
    async () => {
      expect((await sut.files.list("$OUTPUT/capture/SCN-WEB-002")).sort()).toEqual([
        "page-1.png",
        "traces/session.zip",
        "videos/checkout.webm",
      ]);
    },
  );
});
