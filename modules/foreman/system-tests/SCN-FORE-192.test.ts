import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed } from "./foreman.ts";

scenario("SCN-FORE-192", async ({ sut, fakes, given, when, then }) => {
  await given('the README\'s "factory.yaml"', async () => {
    await committed(sut, fakes);
  });

  let stages: Awaited<ReturnType<typeof sut.cli>>;
  let poll: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "foreman serve" with "FOREMAN_MAX_STAGES" set to "0", and once with "FOREMAN_POLL_MS" set to "1s"',
    async () => {
      stages = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN, FOREMAN_MAX_STAGES: "0" } });
      poll = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN, FOREMAN_POLL_MS: "1s" } });
    },
  );

  await then("each command exits with code 2", async () => {
    expect(stages.exitCode, stages.stderr).toBe(2);
    expect(poll.exitCode, poll.stderr).toBe(2);
  });

  await then(
    "the outputs contain 'FOREMAN_MAX_STAGES is \"0\": set a whole number of 1 or more' and 'FOREMAN_POLL_MS is \"1s\": set a whole number of 1 or more'",
    async () => {
      expect(stages.stderr).toContain('FOREMAN_MAX_STAGES is "0": set a whole number of 1 or more');
      expect(poll.stderr).toContain('FOREMAN_POLL_MS is "1s": set a whole number of 1 or more');
    },
  );
});
