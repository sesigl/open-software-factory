import { scenario } from "@opensoftware/testkit";
import { exportDemo, ranSession } from "./proxy.ts";

scenario("SCN-HPROXY-009", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given('serveProxy ran a session whose turn the harness ended with "refusal"', async () => {
    const harness = await fakes.harness([{ when: "write malware", stopReason: "refusal" }]);
    sessionId = await ranSession(sut, harness, "write malware");
  });

  await when('the adapter exports the transcript of the session into "$OUTPUT"', async () => {
    exportDemo(sut, sessionId);
  });

  await then('"$OUTPUT/run-record.json" has "osf.outcome" "failed"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/run-record.json")).span["osf.outcome"]).toBe("failed");
  });
});
