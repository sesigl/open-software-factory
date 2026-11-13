import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, readmeFiles, readmeWork, serving } from "./foreman.ts";

const SERVER = "@modelcontextprotocol/server-everything@2026.1.26";
const SKILL = "---\nname: review\ndescription: Review a plan.\n---\nRead plan.md twice.\n";

scenario("SCN-FORE-142", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" whose agent "plan" declares the MCP server "@modelcontextprotocol/server-everything@2026.1.26" and the skill "./skills/review", with a scripted harness whose "plan" turn prints the skill\'s files',
    async () => {
      await sut.files.put("$INPUT/skills/review/SKILL.md", SKILL);
      const factory = (readmeFiles(fakes)["factory.yaml"] as string).replace(
        "    prompt: ./agents/plan.md\n",
        '    prompt: ./agents/plan.md\n    mcp: ["@modelcontextprotocol/server-everything@2026.1.26"]\n    skills: [./skills/review]\n',
      );
      server = await serving(sut, fakes, {
        factory,
        turns: [
          { when: PLAN, commands: ["cat .claude/skills/review/SKILL.md .agents/skills/review/SKILL.md"] },
          { when: IMPLEMENT, reply: "done" },
        ],
      });
    },
  );

  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then(
    'the harness opened the session of "plan" with the MCP server "server-everything" that runs "npx -y @modelcontextprotocol/server-everything@2026.1.26"',
    async () => {
      expect(server.harness.sessions()[0]?.mcpServers).toEqual([
        { name: "server-everything", command: "npx", args: ["-y", SERVER], env: [] },
      ]);
    },
  );

  await then('the harness opened the session of "implement" with no MCP server', async () => {
    expect(server.harness.sessions()[1]?.mcpServers).toEqual([]);
  });

  await then(
    'the agent of "plan" found the skill\'s "SKILL.md" in ".claude/skills/review" and ".agents/skills/review" of its folder',
    async () => {
      expect(server.harness.commands()).toEqual([expect.objectContaining({ exitCode: 0, output: SKILL + SKILL })]);
    },
  );
});
