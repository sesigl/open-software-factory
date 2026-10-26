import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, sandboxedFactory } from "./foreman.ts";

scenario("SCN-FORE-040", async ({ sut, fakes, given, when, then }) => {
  await given('the README\'s "sandboxed/factory.yaml" with "kubernetes" added under "providers.sandbox"', async () => {
    const factory = sandboxedFactory(fakes).replace('    docker: "^0"', '    docker: "^0"\n    kubernetes: "^0"');
    await sut.files.put("$INPUT/factory.yaml", factory);
    await sut.git.commit("a factory with two sandbox adapters");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the output contains "factory.yaml: /providers/sandbox: name one sandbox adapter, not 2"', async () => {
    expect(run.stderr).toContain("factory.yaml: /providers/sandbox: name one sandbox adapter, not 2");
  });
});
