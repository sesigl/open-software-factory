import { scenario } from "@opensoftware/testkit";
import { readmeFiles } from "./factory.ts";

scenario("SCN-FSPEC-001", async ({ sut, fakes, given, when, then }) => {
  await given("a working folder with the sample factory from the README", async () => {
    const files = readmeFiles(fakes.fromRepository("modules/factory-spec")["README.md"] as string);
    for (const [path, content] of Object.entries(files)) await sut.files.put(`$INPUT/${path}`, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when("the user runs the quick start command from the README", async () => {
    run = await sut.cli(sut.readme.quickStartArgs());
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output folder contains the file the README promises", async () => {
    expect(await sut.files.list("$OUTPUT")).toContain(sut.readme.quickStartOutput());
  });

  await then('".mcp.json" in the output folder starts the server "server-filesystem" with "npx"', async () => {
    const config = JSON.parse(await sut.files.read("$OUTPUT/.mcp.json"));
    expect(config.mcpServers["server-filesystem"].command).toBe("npx");
  });
});
