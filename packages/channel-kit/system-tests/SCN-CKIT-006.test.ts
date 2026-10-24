import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

scenario("SCN-CKIT-006", async ({ given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given('the channel "demo" whose post gives the ID "m-2"', async () => {
    box = demo({ id: "m-2" });
  });

  let ran: Ran;
  await when("the adapter runs 'ask demo:7 \"Merge pull request 12?\"'", async () => {
    ran = await capture((io) => runChannel(box.channel, ["ask", "demo:7", "Merge pull request 12?"], io));
  });

  await then(
    'the channel posted the question "Merge pull request 12?" with the choices "approve" and "reject" in "demo:7"',
    async () => {
      expect(ran.exitCode, ran.stderr).toBe(0);
      expect(box.posts).toEqual([
        { thread: "demo:7", post: { question: "Merge pull request 12?", choices: ["approve", "reject"] } },
      ]);
    },
  );

  await then('standard output is the JSON line {"thread": "demo:7", "id": "m-2"}', async () => {
    expect(ran.exitCode, ran.stderr).toBe(0);
    expect(ran.stdout).toBe(`${JSON.stringify({ thread: "demo:7", id: "m-2" })}\n`);
  });
});
