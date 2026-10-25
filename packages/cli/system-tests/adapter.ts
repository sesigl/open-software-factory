// An adapter program for the runAdapter scenarios: a Node script in $INPUT, run as "node <path>".
import type { Sut } from "@opensoftware/testkit";

/** Writes the script and gives the command line that runs it. */
export async function program(sut: Sut, name: string, script: string): Promise<string> {
  await sut.files.put(`$INPUT/${name}.mjs`, script);
  return `node ${sut.files.path(`$INPUT/${name}.mjs`)}`;
}
