import { writeText } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-011", async ({ sut, when, then }) => {
  await when('the module writes the text "done" to "$OUTPUT/reports/2026/summary.md"', async () => {
    writeText(sut.files.path("$OUTPUT/reports/2026/summary.md"), "done");
  });

  await then('"$OUTPUT/reports/2026/summary.md" has the text "done"', async () => {
    expect(await sut.files.read("$OUTPUT/reports/2026/summary.md")).toBe("done");
  });
});
