import { scenario } from "@opensoftware/testkit";
import { config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFLITE-017", async ({ sut, fakes, given, when, then }) => {
  const api = await provider(fakes, 0);
  const box = gateways(sut);
  const routes = [{ alias: "routes/triage", model: "ft:triage-2026-10" }];
  try {
    let first = { id: "", url: "" };
    await given('a gateway started with "OSF_INFERENCE_OWNER" set to a process that ended', async () => {
      // No process has this ID: it is above the highest process ID of Linux and macOS.
      first = await box.start(config(api.containerUrl as string, routes), { OSF_INFERENCE_OWNER: "99999999" });
    });

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('"start" runs with "OSF_INFERENCE_ORPHAN_AGE" set to "0" and a config that does not exist', async () => {
      run = await sut.cli(["start", "missing.yaml"], { env: { OSF_INFERENCE_ORPHAN_AGE: "0" } });
    });

    await then('"start" exits with code 1', async () => {
      expect(run.exitCode, run.stderr).toBe(1);
    });

    await then('"list" does not print the first gateway', async () => {
      expect((await sut.cli(["list"])).stdout.split("\n")).not.toContain(first.id);
    });
  } finally {
    await box.stopAll();
  }
});
