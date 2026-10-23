import { type AcpClient, type AcpTurn, type Harness, scenario } from "@opensoftware/testkit";

scenario("SCN-HARNESS-004", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given(
    'a harness scripted to keep its turn for "add a date" running until it receives "use the existing date helper"',
    async () => {
      harness = await fakes.harness([{ when: "add a date", waitsFor: "use the existing date helper" }]);
    },
  );

  let client: AcpClient;
  await given("the adapter runs that harness", async () => {
    client = await sut.acp.connect(["run", "--", harness.command, ...harness.args]);
  });

  let first: AcpTurn;
  await when(
    'the client sends the prompt "add a date" and, while the turn runs, sends "use the existing date helper"',
    async () => {
      const session = await client.newSession();
      const running = session.prompt("add a date");
      await new Promise((resolve) => setTimeout(resolve, 200));
      await session.prompt("use the existing date helper");
      first = await running;
    },
  );

  await then('the harness received the prompts "add a date" and "use the existing date helper"', async () => {
    expect(harness.prompts()).toEqual(["add a date", "use the existing date helper"]);
  });

  await then('the turn of "add a date" ends with "end_turn"', async () => {
    expect(first.stopReason).toBe("end_turn");
  });
});
