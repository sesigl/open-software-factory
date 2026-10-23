import { type AcpClient, type Harness, scenario } from "@opensoftware/testkit";
import { serve } from "./proxy.ts";

scenario("SCN-HPROXY-004", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given('a harness scripted to write "fixed" to "notes.md" when the prompt says "fix the typo"', async () => {
    harness = await fakes.harness([{ when: "fix the typo", edits: { "notes.md": "fixed\n" } }]);
  });

  let client: AcpClient;
  await given(
    'serveProxy runs that harness with a hook that moves every session into the subfolder "sub"',
    async () => {
      client = await serve(sut, harness, { newSession: (params) => ({ ...params, cwd: `${params.cwd}/sub` }) });
    },
  );

  await when('the client starts a session in "$INPUT/app" and sends the prompt "fix the typo"', async () => {
    await (await client.newSession("$INPUT/app")).prompt("fix the typo");
  });

  await then('"$INPUT/app/sub/notes.md" says "fixed"', async () => {
    expect(await sut.files.read("$INPUT/app/sub/notes.md")).toBe("fixed\n");
  });
});
