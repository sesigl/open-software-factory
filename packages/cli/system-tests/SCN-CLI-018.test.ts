import { runAdapter } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { program } from "./adapter.ts";

scenario("SCN-CLI-018", async ({ sut, given, when, then }) => {
  let command: string;
  await given('an adapter program that prints its variable "FORGE_URL" as {"url": "<value>"}', async () => {
    command = await program(sut, "env", "console.log(JSON.stringify({ url: process.env.FORGE_URL }));");
  });

  let lines: unknown[];
  await when('the module runs the "forge adapter" with "FORGE_URL" set to "https://forge.test"', async () => {
    const env = { ...process.env, FORGE_URL: "https://forge.test" };
    lines = await runAdapter({ name: "forge adapter", command, env }, ["hooks", "acme/web"]);
  });

  await then('it gets {"url": "https://forge.test"}', async () => {
    expect(lines).toEqual([{ url: "https://forge.test" }]);
  });
});
