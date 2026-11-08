import { scenario } from "@opensoftware/testkit";

const ERROR = "inference-litellm: name a gateway by the 12 hex digits start printed\n";

scenario("SCN-INFLITE-007", async ({ sut, when, then }) => {
  let key: Awaited<ReturnType<typeof sut.cli>>;
  let log: Awaited<ReturnType<typeof sut.cli>>;
  let stop: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the client runs "key 0123456789a run-7", "spend-log x0123456789ab" and "stop 0123456789abx"',
    async () => {
      key = await sut.cli(["key", "0123456789a", "run-7"]);
      log = await sut.cli(["spend-log", "x0123456789ab"]);
      stop = await sut.cli(["stop", "0123456789abx"]);
    },
  );

  await then(
    'each exits with code 2 with the error "inference-litellm: name a gateway by the 12 hex digits start printed"',
    async () => {
      expect(key.exitCode, key.stderr).toBe(2);
      expect(key.stderr).toBe(ERROR);
      expect(log.exitCode, log.stderr).toBe(2);
      expect(log.stderr).toBe(ERROR);
      expect(stop.exitCode, stop.stderr).toBe(2);
      expect(stop.stderr).toBe(ERROR);
    },
  );
});
