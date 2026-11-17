import { type Forge, scenario } from "@opensoftware/testkit";
import { forgeClient } from "./forge.ts";

scenario("SCN-TK-050", async ({ fakes, given, when, then }) => {
  let forge: Forge;
  await given('the repository "demo" in fakes.forge', async () => {
    forge = await fakes.forge();
    await forge.createRepository("demo");
  });

  await when(
    'a module commits "notes.md" with "hello" on the new branch "fix" and opens a pull request "Fix the notes" into "main" through the forge\'s API',
    async () => {
      const api = forgeClient(forge, "demo");
      const content = Buffer.from("hello\n").toString("base64");
      await api("POST", "/contents", {
        branch: "main",
        new_branch: "fix",
        message: "notes",
        files: [{ operation: "create", path: "notes.md", content }],
      });
      await api("POST", "/pulls", { base: "main", head: "fix", title: "Fix the notes", body: "Adds the notes." });
    },
  );

  await then(
    'fakes.forge shows the pull request "Fix the notes" from "fix" into "main" and "notes.md" with "hello" only on "fix"',
    async () => {
      expect(await forge.pullRequests("demo")).toEqual([
        expect.objectContaining({
          number: 1,
          title: "Fix the notes",
          body: "Adds the notes.",
          head: "fix",
          base: "main",
          state: "open",
        }),
      ]);
      expect(await forge.file("demo", "notes.md", "fix")).toBe("hello\n");
      expect(await forge.file("demo", "notes.md", "main")).toBeUndefined();
    },
  );
});
