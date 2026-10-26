import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed, gatewayFactory } from "./foreman.ts";

scenario("SCN-FORE-057", async ({ sut, fakes, given, when, then }) => {
  await given('the README\'s "gateway/factory.yaml" without "inference"', async () => {
    const factory = gatewayFactory(fakes).replace(/^inference:\n( {2}.*\n)+/m, "");
    expect(factory).not.toContain("budget");
    await committed(sut, fakes, factory);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then('the command exits with code 2 and names "/inference" and "inference.config"', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain("factory.yaml: /inference: give the inference adapter's config as inference.config");
  });
});
