import { scenario } from "@opensoftware/testkit";
import { ADA, buttons, foreman, GATE, gatedRun, open, pendingGate, RUN, rows, serving } from "./console.ts";

scenario("SCN-CONSOLE-250", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email", a foreman with a run whose stage "ship" waits at the gate "g0123456789abcdef", and gatekeeper whose gate is "approved"',
    async () => {
      const api = await foreman(fakes, [gatedRun()]);
      const { waitingFor: _, ...decided } = pendingGate;
      const gatekeeper = await fakes.http([{ path: `/v1/gates/${GATE}`, body: { ...decided, state: "approved" } }]);
      await serving(sut, [api.url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_GATEKEEPER_URL: gatekeeper.url,
      });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('the person "ada@acme.dev" opens the run\'s page', async () => {
    page = await open(sut, `/runs/${RUN}`, ADA);
  });

  await then('the page shows the gate "g0123456789abcdef" of the stage "ship" as "approved"', async () => {
    expect(rows(page)[1]).toEqual(["ship", "shipper", "blocked", "", `${GATE} approved`, "", ""]);
  });

  await then('the page has the forms "Steer" and "Cancel", and no form "Approve" or "Reject"', async () => {
    expect(buttons(page)).toEqual(["Steer", "Cancel"]);
    expect(page.forms.map((form) => form.action)).not.toContain(`/runs/${RUN}/gates/${GATE}`);
  });
});
