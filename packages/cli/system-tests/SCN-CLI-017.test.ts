import { runAdapter } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { program } from "./adapter.ts";

scenario("SCN-CLI-017", async ({ sut, given, when, then }) => {
  let command: string;
  await given('an adapter program that prints the lines {"id": 1} and {"id": 2} for "hooks acme/web"', async () => {
    command = await program(
      sut,
      "hooks",
      `if (process.argv.slice(2).join(" ") === "hooks acme/web") console.log('{"id": 1}\\n{"id": 2}');`,
    );
  });

  let lines: unknown[];
  await when('the module runs the "forge adapter" with "hooks acme/web"', async () => {
    lines = await runAdapter({ name: "forge adapter", command, env: process.env }, ["hooks", "acme/web"]);
  });

  await then('it gets {"id": 1} and {"id": 2} in this order', async () => {
    expect(lines).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
