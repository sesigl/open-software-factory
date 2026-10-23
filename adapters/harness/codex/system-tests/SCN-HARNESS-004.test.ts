import { type AcpClient, type AcpTurn, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, responsesCalls, until, withTitle } from "./codex.ts";

scenario("SCN-HARNESS-004", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'a harness scripted to keep its turn for "add a date" running until it receives "use the existing date helper"',
    async () => {
      // The model runs a two-second command again after each result until a call carries the steering message:
      // Codex hands it to the model with the next tool result.
      const sleep = { name: "exec_command", input: { cmd: "sleep 2" } };
      gateway = await fakes.modelGateway(
        withTitle([
          { when: "add a date", reply: "", tools: [sleep] },
          { when: "use the existing date helper", reply: "done" },
        ]),
      );
    },
  );

  let client: AcpClient;
  await given("the adapter runs that harness", async () => {
    client = await connect(sut, gateway);
  });

  let turns: AcpTurn[] = [];
  await when(
    'the client sends the prompt "add a date" and, while the turn runs, sends "use the existing date helper"',
    async () => {
      const session = await client.newSession();
      const running = session.prompt("add a date");
      // The model asked for the command; it runs for two seconds.
      await until(() => responsesCalls(gateway).length > 0);
      await new Promise((resolve) => setTimeout(resolve, 300));
      turns = await Promise.all([running, session.prompt("use the existing date helper")]);
    },
  );

  await then('the harness received the prompts "add a date" and "use the existing date helper"', async () => {
    const last = JSON.stringify(responsesCalls(gateway).at(-1));
    expect(last).toContain("add a date");
    expect(last).toContain("use the existing date helper");
  });

  await then('the turn of "add a date" ends with "end_turn"', async () => {
    expect(turns[0]).toEqual({ stopReason: "end_turn", reply: "done" });
  });
});
