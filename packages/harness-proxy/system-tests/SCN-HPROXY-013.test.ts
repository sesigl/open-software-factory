import { scenario } from "@opensoftware/testkit";
import { DATA, exportDemo, linesOf, serve } from "./proxy.ts";

scenario("SCN-HPROXY-013", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given('serveProxy runs a session whose turn for "add a date" is still running', async () => {
    const harness = await fakes.harness([
      { when: "fix the typo", reply: "done" },
      { when: "add a date", waitsFor: "never" },
    ]);
    const session = await (await serve(sut, harness)).newSession();
    sessionId = session.id;
    await session.prompt("fix the typo");
    // The turn never ends; the connection closes with the scenario.
    session.prompt("add a date").catch(() => undefined);
    while (!(await sut.files.read(`${DATA}/sessions/${sessionId}.jsonl`)).includes("add a date")) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });

  await when('the adapter exports the transcript of the session into "$OUTPUT"', async () => {
    exportDemo(sut, sessionId);
  });

  await then('"$OUTPUT/run-record.json" has "osf.outcome" "failed"', async () => {
    expect((await linesOf(sut, "$OUTPUT/transcript.jsonl")).at(-1)).toEqual({
      type: "prompt",
      prompt: [{ type: "text", text: "add a date" }],
    });
    expect(JSON.parse(await sut.files.read("$OUTPUT/run-record.json")).span["osf.outcome"]).toBe("failed");
  });
});
