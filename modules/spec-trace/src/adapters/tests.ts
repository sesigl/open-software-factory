// Test files, read as TypeScript ASTs with ts-morph: each call of the scenario function and its step calls.
import { type CallExpression, Node, Project, SyntaxKind } from "ts-morph";
import type { Keyword, Test } from "../domain/model.ts";

// biome-ignore lint/suspicious/noThenProperty: `then` is the Gherkin keyword; this map is never awaited.
const STEP_KEYWORDS: Record<string, Keyword> = { given: "Given", when: "When", then: "Then" };

export function readTests(file: string, text: string, name: string): Test[] {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } });
  const source = project.createSourceFile(`/${file}`, text);
  return source
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === name)
    .map((call) => readTest(file, call));
}

function readTest(file: string, call: CallExpression): Test {
  const [idArg, body] = call.getArguments();
  const steps = (body?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? []).flatMap((step) => {
    const keyword = STEP_KEYWORDS[step.getExpression().getText()];
    const label = step.getArguments()[0];
    if (!keyword) return [];
    return [{ keyword, label: literal(label), line: step.getStartLineNumber() }];
  });
  return { file, line: call.getStartLineNumber(), id: literal(idArg), steps };
}

function literal(node: Node | undefined): string | null {
  return node && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    ? node.getLiteralText()
    : null;
}
