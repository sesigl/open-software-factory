// The pages "/skills" and "/skills/<name>" (ADR 0141): every skill the factory's agents use, in every mode of the
// console. The console runs `factory skills` for the skills and, with a store, the secrets port's adapter for the state
// of each secret a skill needs. With a factory repository and the role, a skill's page switches the skill on or off
// per agent: a change of the factory (ADR 0144) that the page "/skills/<name>/switch" asks for first (ADR 0149).
import type { ShellData } from "@opensoftware/ui";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { readFactory } from "../adapters/factory-file.ts";
import { listSecrets } from "../adapters/secrets.ts";
import { readSkills } from "../adapters/skills.ts";
import { render } from "../adapters/web.ts";
import { needsOf, statesOf, switchesOf, switchOf } from "../domain/skills.ts";
import { skillData, skillsData, switchData } from "../pages/skills.ts";
import { type FactoryRepository, readChanges, whyNoChange } from "./changes.ts";

export interface SkillsSetup {
  /** The command line of the factory program, CONSOLE_FACTORY_COMMAND. */
  command: string;
  factoryFile: string;
  /** The command line of the secrets port's adapter, or undefined for a console without a store. */
  store: string | undefined;
  /** The factory's repository of the changes, or undefined for a factory from a local folder. */
  repository: FactoryRepository | undefined;
  /** Why this console has no person with a role, or undefined when it has. */
  closed: string | undefined;
  /** The shell of a page in the new look for this request. */
  shell(request: FastifyRequest, title: string): ShellData;
  /** Whether the person of the request may open "/secrets". */
  secrets(request: FastifyRequest): boolean;
  /** Answers with a page that names a problem. */
  problem(reply: FastifyReply, status: number, title: string, detail: string): unknown;
}

export function useSkills(app: FastifyInstance, setup: SkillsSetup): void {
  const { repository } = setup;

  /** The skills, the needs of a skill with the state of each secret, and what could not be read. */
  const load = async () => {
    const [skills, listed] = await Promise.all([
      readSkills(setup.command, setup.factoryFile),
      setup.store ? listSecrets(setup.store) : undefined,
    ]);
    const states = statesOf(readFactory(setup.factoryFile).agents, listed?.ok ? listed.body : undefined);
    const failed = skills.ok ? undefined : `The skills could not be read: ${skills.note}`;
    const notes = [
      ...(failed ? [failed] : []),
      ...(listed?.ok === false ? [`The secrets could not be listed: ${listed.note}`] : []),
    ];
    return {
      failed,
      skills: skills.ok ? skills.body : [],
      needs: (skill: Parameters<typeof needsOf>[0]) => needsOf(skill, states, Boolean(setup.store)),
      notes,
    };
  };

  app.get("/skills", async (request, reply) => {
    const { skills, needs, notes } = await load();
    const shell = setup.shell(request, "Skills");
    return render(request, reply, 200, skillsData(shell, skills, needs, notes, setup.secrets(request)));
  });

  /** The skill of the name, or the answer that names why there is none. */
  const skillOf = async (reply: FastifyReply, name: string) => {
    const loaded = await load();
    const skill = loaded.skills.find((each) => each.name === name);
    if (loaded.failed) return { refused: setup.problem(reply, 502, name, loaded.failed) };
    if (!skill)
      return { refused: setup.problem(reply, 404, name, `no skill ${name}: no agent of the factory uses it`) };
    return { ...loaded, skill };
  };

  app.get<{ Params: { name: string } }>("/skills/:name", async (request, reply) => {
    const { name } = request.params;
    const found = await skillOf(reply, name);
    if ("refused" in found) return found.refused;
    const { skill, needs, notes } = found;
    // The open changes that switch this skill, so that each shows beside its agent in place of the switch.
    const changes = repository
      ? await readChanges(repository, (pull) => pull.state === "open" && switchesOf([pull], skill).size > 0)
      : { pulls: [], notes: [] };
    // The Markdown library loads with the first skill page: a console starts without it.
    const { htmlOf } = await import("../domain/markdown.ts");
    const html = htmlOf(skill.body ?? "");
    const switches = {
      agents: Object.keys(readFactory(setup.factoryFile).agents ?? {}),
      why: whyNoChange(repository, setup.closed, request)?.detail,
      changes: switchesOf(changes.pulls, skill),
    };
    const shell = setup.shell(request, name);
    const data = skillData(
      shell,
      skill,
      needs(skill),
      [...notes, ...changes.notes],
      setup.secrets(request),
      html,
      switches,
    );
    return render(request, reply, 200, data, "skills/skill");
  });

  // The page that asks first: it lists every edit of the switch, and its form posts them to "/changes".
  app.get<{ Params: { name: string }; Querystring: { agent?: string } }>(
    "/skills/:name/switch",
    async (request, reply) => {
      const { name } = request.params;
      const why = whyNoChange(repository, setup.closed, request);
      if (why) return setup.problem(reply, why.status, why.status === 404 ? "No changes" : "Forbidden", why.detail);
      const found = await skillOf(reply, name);
      if ("refused" in found) return found.refused;
      const agent = request.query.agent ?? "";
      const change = switchOf(found.skill, readFactory(setup.factoryFile), agent);
      if (!change) return setup.problem(reply, 404, name, `${agent || "nothing"} is not an agent of the factory`);
      const data = switchData(setup.shell(request, `Switch ${name}`), name, agent, change);
      return render(request, reply, 200, data, "skills/switch");
    },
  );
}
