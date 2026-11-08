import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SKUBE-016", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  /** Snapshots the sandbox and gives the name of the snapshot's SandboxTemplate. */
  const snapshot = async (id: string): Promise<string> => {
    const run = await box.cli(["snapshot", id]);
    expect(run.exitCode, run.stderr).toBe(0);
    return run.stdout.trim();
  };
  try {
    let second = "";
    await given('a sandbox created from a snapshot of a sandbox in which "notes.md" says "draft"', async () => {
      const first = await box.create({ template: TEMPLATE });
      await box.sh(first, "printf draft > notes.md");
      second = await box.create({ template: await snapshot(first) });
    });

    await given('in it "notes.md" says "final" and "todo.md" says "ship"', async () => {
      const written = await box.sh(second, "printf final > notes.md && printf ship > todo.md");
      expect(written.exitCode, written.stderr).toBe(0);
    });

    let third = "";
    await when("the client snapshots that sandbox and creates a third sandbox from the second snapshot", async () => {
      third = await box.create({ template: await snapshot(second) });
    });

    await then('"cat notes.md todo.md" in the third sandbox prints "finalship"', async () => {
      const run: CliResult = await box.cli(["exec", third, "--", "cat", "notes.md", "todo.md"]);
      expect(run.stdout, run.stderr).toBe("finalship");
    });
  } finally {
    await box.destroyAll();
  }
});
