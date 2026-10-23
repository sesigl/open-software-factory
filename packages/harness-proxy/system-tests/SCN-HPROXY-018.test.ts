import { type AcpClient, type AcpTurn, type Harness, scenario } from "@opensoftware/testkit";
import { serve } from "./proxy.ts";

scenario("SCN-HPROXY-018", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given(
    'a harness scripted to keep its turn for "add a date" running until it receives "use the existing date helper"',
    async () => {
      harness = await fakes.harness([{ when: "add a date", waitsFor: "use the existing date helper", reply: "done" }]);
    },
  );

  let client: AcpClient;
  await given('serveProxy runs that harness with the steering request "_session/steering"', async () => {
    client = await serve(sut, harness, { steering: "_session/steering" });
  });

  let turns: AcpTurn[] = [];
  await when(
    'the client sends the prompt "add a date" and, while the turn runs, sends "use the existing date helper"',
    async () => {
      const session = await client.newSession();
      const running = session.prompt("add a date");
      await new Promise((resolve) => setTimeout(resolve, 200));
      turns = await Promise.all([running, session.prompt("use the existing date helper")]);
    },
  );

  await then('the harness received "use the existing date helper" as the request "_session/steering"', async () => {
    expect(harness.steeringRequests()).toEqual(["use the existing date helper"]);
    expect(harness.prompts()).toEqual(["add a date", "use the existing date helper"]);
  });

  await then('both prompts end with "end_turn"', async () => {
    expect(turns.map((turn) => turn.stopReason)).toEqual(["end_turn", "end_turn"]);
  });
});
