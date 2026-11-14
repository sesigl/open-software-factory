// "factory edit": one edit of factory.yaml, printed for the program that commits it (T-58); the file stays as it is.
import { readText } from "../adapters/files.ts";
import { addSecretsProvider, editList, LISTS, type List } from "../domain/edit.ts";
import { fail } from "../domain/errors.ts";
import { lintFile } from "./load.ts";

type Change = (text: string, first: string, second: string) => string;

const CHANGES = new Map<string, Change>([
  ...(Object.keys(LISTS) as List[]).flatMap((list): [string, Change][] => [
    [`add-${list}`, (text, agent, value) => editList(text, agent, list, value, true)],
    [`remove-${list}`, (text, agent, value) => editList(text, agent, list, value, false)],
  ]),
  ["add-secrets-provider", addSecretsProvider],
]);

const USAGE = `usage: factory edit ${[...CHANGES.keys()].slice(0, -1).join("|")} <agent> <value>, or factory edit add-secrets-provider <name> <range>`;

/** The text of the file after the edit; an edit of a file or into a text that does not pass lint fails. */
export function edit(file: string, [operation = "", ...values]: string[]): string {
  const change = CHANGES.get(operation);
  if (!change || values.length !== 2) fail(USAGE);
  const text = readText(file);
  passes(file, text, `${file} does not pass "factory lint"`);
  const edited = change(text, values[0] as string, values[1] as string);
  passes(file, edited, `the edit would make ${file} fail "factory lint"`);
  return edited;
}

function passes(file: string, text: string, refusal: string): void {
  const { problems } = lintFile(file, false, text);
  if (problems.length > 0) fail(`${refusal}: ${problems.join("; ")}`);
}
