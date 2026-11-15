// The pages "/skills" and "/skills/<name>" (ADR 0141): every skill the factory's agents use, read-only, in every mode
// of the console. The console runs `factory skills` for the skills and, with a store, the secrets port's adapter for
// the state of each secret a skill needs.
import type { ShellData } from "@opensoftware/ui";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { readFactory } from "../adapters/factory-file.ts";
import { listSecrets } from "../adapters/secrets.ts";
import { readSkills } from "../adapters/skills.ts";
import { render } from "../adapters/web.ts";
import { needsOf, statesOf } from "../domain/skills.ts";
import { skillData, skillsData } from "../pages/skills.ts";

export interface SkillsSetup {
  /** The command line of the factory program, CONSOLE_FACTORY_COMMAND. */
  command: string;
  factoryFile: string;
  /** The command line of the secrets port's adapter, or undefined for a console without a store. */
  store: string | undefined;
  /** The shell of a page in the new look for this request. */
  shell(request: FastifyRequest, title: string): ShellData;
  /** Whether the person of the request may open "/secrets". */
  secrets(request: FastifyRequest): boolean;
  /** Answers with a page that names a problem. */
  problem(reply: FastifyReply, status: number, title: string, detail: string): unknown;
}

export function useSkills(app: FastifyInstance, setup: SkillsSetup): void {
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

  app.get<{ Params: { name: string } }>("/skills/:name", async (request, reply) => {
    const { name } = request.params;
    const { failed, skills, needs, notes } = await load();
    const skill = skills.find((each) => each.name === name);
    if (failed) return setup.problem(reply, 502, name, failed);
    if (!skill) return setup.problem(reply, 404, name, `no skill ${name}: no agent of the factory uses it`);
    // The Markdown library loads with the first skill page: a console starts without it.
    const { htmlOf } = await import("../domain/markdown.ts");
    const html = htmlOf(skill.body ?? "");
    const data = skillData(setup.shell(request, name), skill, needs(skill), notes, setup.secrets(request), html);
    return render(request, reply, 200, data, "skills/skill");
  });
}
