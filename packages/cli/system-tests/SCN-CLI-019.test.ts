import { runAdapter } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { program } from "./adapter.ts";

scenario("SCN-CLI-019", async ({ sut, given, when, then }) => {
  let command: string;
  await given(
    'an adapter program that writes "the forge refused the token" to standard error and exits with code 1',
    async () => {
      command = await program(
        sut,
        "refused",
        'console.log("{}"); console.error("the forge refused the token"); process.exitCode = 1;',
      );
    },
  );

  let run: Promise<unknown[]>;
  await when('the module runs the "forge adapter" with "hooks acme/web"', async () => {
    run = runAdapter({ name: "forge adapter", command, env: process.env }, ["hooks", "acme/web"]);
    run.catch(() => undefined);
  });

  await then('it gets the error "hooks acme/web: the forge refused the token"', async () => {
    await expect(run).rejects.toThrow(/^hooks acme\/web: the forge refused the token$/);
  });
});
