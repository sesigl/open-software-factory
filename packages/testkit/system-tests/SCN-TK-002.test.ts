import { scenario } from "@opensoftware/testkit";
import { demoModule } from "./module.ts";

scenario("SCN-TK-002", async ({ sut, given, when, then }) => {
  await given('a module whose system test puts the file "$INPUT/../secret.txt"', async () => {
    const module = demoModule(['await sut.files.put("$INPUT/../secret.txt", "secret");']);
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "sut.files refuses a path outside $INPUT and $OUTPUT: $INPUT/../secret.txt"',
    async () => {
      expect(run.stdout + run.stderr).toContain(
        "sut.files refuses a path outside $INPUT and $OUTPUT: $INPUT/../secret.txt",
      );
    },
  );
});
