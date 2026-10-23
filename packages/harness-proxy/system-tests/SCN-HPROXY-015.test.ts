import { runAdapter } from "@opensoftware/harness-proxy";
import { scenario } from "@opensoftware/testkit";
import { captured, DATA, demoAdapter, serveDemo } from "./proxy.ts";

scenario("SCN-HPROXY-015", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'runAdapter "run" for the adapter "demo" with OSF_DATA "$OUTPUT/data" ran a session with the prompt "fix the typo"',
    async () => {
      const harness = await fakes.harness([{ when: "fix the typo", reply: "done" }]);
      const client = await serveDemo(sut, ["--", harness.command, ...harness.args], {
        OSF_DATA: sut.files.path(DATA),
      });
      const session = await client.newSession();
      sessionId = session.id;
      await session.prompt("fix the typo");
    },
  );

  const output = captured();
  let code = 1;
  await when(
    'runAdapter runs "transcript" with the session\'s ID, OSF_DATA "$OUTPUT/data" and OUTPUT "$OUTPUT/out"',
    async () => {
      const env = { OSF_DATA: sut.files.path(DATA), OUTPUT: sut.files.path("$OUTPUT/out") };
      code = await runAdapter(demoAdapter, { args: ["transcript", sessionId], env, io: output.io });
    },
  );

  await then(
    'it gives 0 and prints "wrote $OUTPUT/out/run-record.json" and "wrote $OUTPUT/out/transcript.jsonl"',
    async () => {
      expect(code, output.stderr).toBe(0);
      const written = ["run-record.json", "transcript.jsonl"].map(
        (file) => `wrote ${sut.files.path(`$OUTPUT/out/${file}`)}`,
      );
      expect(output.stdout).toBe(`${written.join("\n")}\n`);
    },
  );

  await then(
    '"$OUTPUT/out/run-record.json" has "service.name" "harness-demo" and "osf.harness.name" "demo"',
    async () => {
      const { resource } = JSON.parse(await sut.files.read("$OUTPUT/out/run-record.json"));
      expect(resource["service.name"]).toBe("harness-demo");
      expect(resource["osf.harness.name"]).toBe("demo");
    },
  );
});
