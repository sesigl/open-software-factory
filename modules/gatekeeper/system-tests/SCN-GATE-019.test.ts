import { scenario } from "@opensoftware/testkit";
import { GATE, replies, requested } from "./gate.ts";

scenario("SCN-GATE-019", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given(
    'the approval request of the README request, made at "2026-01-01T00:00:00Z" with "escalate_after" "4h" to "leads"',
    async () => {
      setup = await requested(sut, fakes, { OSF_NOW: "2026-01-01T00:00:00Z" });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" with the same arguments at "2026-01-01T05:00:00Z"', async () => {
    run = await sut.cli(["status", ...GATE], { env: { ...setup.env, OSF_NOW: "2026-01-01T05:00:00Z" } });
  });

  await then("the command exits with code 3", async () => {
    expect(run.exitCode, run.stderr).toBe(3);
  });

  await then('the thread has a reply that asks "leads" to approve', async () => {
    expect(replies(setup.slack, setup.message)).toEqual([
      expect.stringMatching(
        /^No decision after 4h\. Approval needed from leads: Merge the new checkout flow\n.*\n\[gatekeeper g[0-9a-f]{16} escalated\]$/,
      ),
    ]);
  });

  await then('the output says "waiting for maintainers, leads"', async () => {
    expect(run.stdout).toMatch(/waiting for maintainers, leads$/m);
  });
});
