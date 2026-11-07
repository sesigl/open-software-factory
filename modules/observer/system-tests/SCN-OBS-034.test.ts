import { type Forge, type ModelGateway, scenario } from "@opensoftware/testkit";
import { factoryRepository, modelAnswering, RESEARCH_FIX, writeProblems } from "./factory.ts";

scenario("SCN-OBS-034", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given('a Forgejo repository "tester/factory" whose "AGENTS.md" says "Investigate inline."', async () => {
    forge = await factoryRepository(fakes);
  });
  await given(
    '"problems.json" with the problem "research-skill-used" of 30 failures in 40 runs, the first of them "run-1" with the reason "Investigated inline." and the transcript "https://langfuse.example/trace/1"',
    () => writeProblems(sut),
  );

  let gateway: ModelGateway;
  await given(
    'the model gateway answers a prompt with "Investigated inline." with the solution "Tell the triage agent to use the research skill." and an edit of "AGENTS.md" from "Investigate inline." to "Use the research skill before you investigate."',
    async () => {
      gateway = await modelAnswering(fakes, RESEARCH_FIX);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer propose --repo <forge URL>/tester/factory problems.json" with "OBSERVER_INFERENCE_URL" "<gateway URL>//" and "OBSERVER_INFERENCE_KEY" "gateway-key-1"',
    async () => {
      run = await sut.cli(["propose", "--repo", `${forge.url}/tester/factory`, "problems.json"], {
        env: {
          OBSERVER_INFERENCE_URL: `${gateway.url}//`,
          OBSERVER_INFERENCE_KEY: "gateway-key-1",
          OBSERVER_FORGE_TOKEN: forge.token,
        },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the model gateway got one call of "/v1/chat/completions" with the header "authorization" "Bearer gateway-key-1"',
    async () => {
      expect(gateway.calls.map((call) => call.path)).toEqual(["/v1/chat/completions"]);
      expect(gateway.calls[0]?.headers.authorization).toBe("Bearer gateway-key-1");
    },
  );

  await then('the prompt ends with "File AGENTS.md:" and the text of "AGENTS.md" in a code fence', async () => {
    const body = JSON.parse(gateway.calls[0]?.body ?? "{}") as { messages: { role: string; content: string }[] };
    const user = body.messages.find((message) => message.role === "user")?.content ?? "";
    expect(user.endsWith("\n\nFile AGENTS.md:\n```\n# Agents\n\nInvestigate inline.\n\n```\n")).toBe(true);
  });
});
