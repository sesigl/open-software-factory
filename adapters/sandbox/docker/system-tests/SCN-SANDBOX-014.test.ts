import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-014", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given('a sandbox created from a spec with the test template, in which "notes.md" says "draft"', async () => {
      id = await box.create({ template: TEMPLATE });
      await box.sh(id, "printf draft > notes.md");
    });

    let second = "";
    await when("the client snapshots the sandbox and creates a second sandbox from the snapshot", async () => {
      const snapshot = await sut.cli(["snapshot", id]);
      expect(snapshot.exitCode, snapshot.stderr).toBe(0);
      second = await box.create({ template: snapshot.stdout.trim() });
    });

    await then('"cat notes.md" in the second sandbox prints "draft"', async () => {
      const run = await sut.cli(["exec", second, "--", "cat", "notes.md"]);
      expect(run.stdout, run.stderr).toBe("draft");
    });
  } finally {
    await box.destroyAll();
  }
});
