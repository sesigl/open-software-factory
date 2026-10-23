import { scenario } from "@opensoftware/testkit";
import { exportDemo, serve } from "./proxy.ts";

scenario("SCN-HPROXY-008", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given("serveProxy ran a session whose turn was cancelled", async () => {
    const harness = await fakes.harness([{ when: "add a date", waitsFor: "never" }]);
    const session = await (await serve(sut, harness)).newSession();
    sessionId = session.id;
    const running = session.prompt("add a date");
    await new Promise((resolve) => setTimeout(resolve, 200));
    await session.cancel();
    await running;
  });

  await when('the adapter exports the transcript of the session into "$OUTPUT"', async () => {
    exportDemo(sut, sessionId);
  });

  await then('"$OUTPUT/run-record.json" has "osf.outcome" "cancelled"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/run-record.json")).span["osf.outcome"]).toBe("cancelled");
  });
});
