import { scenario } from "@opensoftware/testkit";
import { GATE, requested } from "./gate.ts";

scenario("SCN-GATE-020", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given(
    'the approval request of the README request, escalated to "leads" at "2026-01-01T05:00:00Z"',
    async () => {
      setup = await requested(sut, fakes);
      const escalated = await sut.cli(["status", ...GATE], { env: { ...setup.env, OSF_NOW: "2026-01-01T05:00:00Z" } });
      expect(escalated.stdout).toContain("waiting for maintainers, leads");
    },
  );

  await given('"slack:U0LEO" of "leads" replied "approve" in its thread after the escalation', async () => {
    await setup.slack.say({ channel: "C0GATES", text: "approve", user: "U0LEO", threadTs: setup.message.ts });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" with the same arguments at "2026-01-01T05:10:00Z"', async () => {
    run = await sut.cli(["status", ...GATE], { env: { ...setup.env, OSF_NOW: "2026-01-01T05:10:00Z" } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "approved by slack:U0LEO"', async () => {
    expect(run.stdout).toMatch(/approved by slack:U0LEO$/m);
  });
});
