// The skills of the factory from `factory skills` of factory-spec, run as a program (ADR 0135, ADR 0141): the console
// never parses a SKILL.md itself.
import type { Skill } from "../domain/skills.ts";
import { runProgram } from "./program.ts";

/** Every skill the agents of the factory definition in `file` use, from the factory program `command`. */
export const readSkills = (command: string, file: string) =>
  runProgram(command, ["skills", "--file", file], (stdout) => (JSON.parse(stdout) as { skills: Skill[] }).skills);
