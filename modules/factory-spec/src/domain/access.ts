// The access file `access.yaml` beside factory.yaml (ADR 0134): its people by email, each with one role. `factory lint`
// reports what would keep the console's sign-in from letting anybody in.
import { validate } from "@opensoftware/contracts";
import { parse } from "yaml";

/** The problems of the access file's text, each as `<file> <JSON Pointer>: <problem>` or `<file>: <problem>`. */
export function accessProblems(text: string, file: string): string[] {
  let document: unknown;
  try {
    document = parse(text);
  } catch (error) {
    return [`${file}: ${(error as Error).message.split("\n")[0]}`];
  }
  const problems = validate("access", document).map((problem) => `${file} ${problem.path}: ${problem.message}`);
  if (problems.length) return problems;
  const roles = (document as { people: { role: string }[] }).people.map((person) => person.role);
  return roles.includes("admin") ? [] : [`${file}: no person has the role admin, so nobody can change who signs in`];
}
