import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed } from "./foreman.ts";

scenario("SCN-FORE-185", async ({ sut, fakes, given, when, then }) => {
  let port = "";
  await given("another program listens on a port", async () => {
    port = new URL((await fakes.http([])).url).port;
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "foreman serve" with "PORT" set to that port, "FOREMAN_TEMPORAL_ADDRESS" set to Temporal and "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      await committed(sut, fakes);
      const [temporal, nats] = await Promise.all([fakes.temporal(), fakes.nats()]);
      run = await sut.cli(["serve"], {
        env: {
          FOREMAN_API_TOKEN: API_TOKEN,
          FOREMAN_TEMPORAL_ADDRESS: temporal.address,
          FOREMAN_TEMPORAL_NAMESPACE: temporal.namespace,
          FOREMAN_NATS_URL: nats.url,
          PORT: port,
        },
      });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
  });

  await then('the output contains "listen EADDRINUSE"', async () => {
    expect(run.stderr).toContain("foreman: listen EADDRINUSE");
  });
});
