import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-013", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given("a sandbox created from a spec with the test template", async () => {
      id = await box.create({ template: TEMPLATE });
    });

    await when(
      'the client runs "echo done > result.txt" in the sandbox and copies the sandbox\'s "result.txt" to "$OUTPUT/result.txt"',
      async () => {
        await box.sh(id, "echo done > result.txt");
        const copied = await box.cli(["copy", `${id}:result.txt`, sut.files.path("$OUTPUT/result.txt")]);
        expect(copied.exitCode, copied.stderr).toBe(0);
      },
    );

    await then('"$OUTPUT/result.txt" says "done"', async () => {
      expect(await sut.files.read("$OUTPUT/result.txt")).toBe("done\n");
    });
  } finally {
    await box.destroyAll();
  }
});
