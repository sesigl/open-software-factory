import { scenario } from "@opensoftware/testkit";

scenario("SCN-TEMPLATE-002", async ({ sut, given, when, then }) => {
  await given("an empty working folder", async () => {
    await sut.files.clear("$INPUT");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "module-template hello Ada"', async () => {
    run = await sut.cli(["hello", "Ada"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"$OUTPUT/hello.txt" holds the text "Hello, Ada"', async () => {
    expect(await sut.files.read("$OUTPUT/hello.txt")).toBe("Hello, Ada\n");
  });

  await then('the output names the file "$OUTPUT/hello.txt"', async () => {
    expect(run.stdout).toMatch(/^wrote .*hello\.txt$/m);
  });
});
