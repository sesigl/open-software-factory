// Reads system test files into one shape for TRACE, STEPS, NOSKIP, ASSERT, BOUNDARY-STATIC and BOUNDARY-ENV.
// TypeScript is read with ts-morph, Python with its own `ast` module (checks/py/scan_tests.py).
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type CallExpression, Node, Project, SyntaxKind } from "ts-morph";
import type { Repo } from "./repo.ts";

export const TEST_GLOBS = ["**/system-tests/**/*.test.ts", "**/system-tests/**/test_*.py"];
export const SYSTEM_TEST_SOURCES = ["**/system-tests/**/*.ts", "**/system-tests/**/*.py"];

export interface TestStep {
  keyword: "Given" | "When" | "Then";
  /** The label when it is a string literal, otherwise null. */
  label: string | null;
  line: number;
  assertions: number;
  /** At least one assertion reads a value that came from `sut` or `fakes`. */
  assertsOnSut: boolean;
}

export interface TestScenario {
  id: string | null;
  line: number;
  steps: TestStep[];
}

export interface Located {
  name: string;
  line: number;
}

export interface TestFile {
  file: string;
  isTest: boolean;
  scenarios: TestScenario[];
  imports: Located[];
  skips: Located[];
  env: Located[];
}

// biome-ignore lint/suspicious/noThenProperty: `then` is the Gherkin keyword; this map is never awaited.
const STEP_KEYWORDS: Record<string, TestStep["keyword"]> = { given: "Given", when: "When", then: "Then" };
const SKIP_PROPERTIES = new Set(["skip", "only", "todo", "fails", "skipIf", "runIf"]);
const RUNNERS = new Set(["test", "it", "describe", "suite", "scenario", "bench", "given", "when", "then"]);
const SKIP_FUNCTIONS = new Set(["xit", "xtest", "xdescribe", "fit", "fdescribe"]);
const SOURCES = new Set(["sut", "fakes"]);

let cache: TestFile[] | undefined;

/** Every file in a system-tests folder (helpers included); `isTest` marks the test files. */
export function loadTests(repo: Repo): TestFile[] {
  if (cache) return cache;
  const isTest = new Set(repo.match(...TEST_GLOBS));
  const files = repo.match(...SYSTEM_TEST_SOURCES);
  const typescript = files.filter((file) => file.endsWith(".ts")).map((file) => scanTypeScript(file, repo.read(file)));
  const python = scanPython(
    repo,
    files.filter((file) => file.endsWith(".py")),
  );
  cache = [...typescript, ...python].map((test) => ({ ...test, isTest: isTest.has(test.file) }));
  return cache;
}

export function scanTypeScript(file: string, text: string): TestFile {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } });
  const source = project.createSourceFile(`/${file}`, text);
  const result: TestFile = { file, isTest: true, scenarios: [], imports: [], skips: [], env: [] };

  for (const declaration of [...source.getImportDeclarations(), ...source.getExportDeclarations()]) {
    const name = declaration.getModuleSpecifierValue();
    if (name) result.imports.push({ name, line: declaration.getStartLineNumber() });
  }

  for (const node of source.getDescendants()) {
    if (Node.isCallExpression(node)) {
      const callee = node.getExpression();
      const first = node.getArguments()[0];
      const literal = first && (Node.isStringLiteral(first) || Node.isNoSubstitutionTemplateLiteral(first));
      if ((callee.getKind() === SyntaxKind.ImportKeyword || callee.getText() === "require") && literal) {
        result.imports.push({ name: first.getLiteralText(), line: node.getStartLineNumber() });
      }
      if (Node.isIdentifier(callee) && SKIP_FUNCTIONS.has(callee.getText())) {
        result.skips.push({ name: callee.getText(), line: node.getStartLineNumber() });
      }
      if (callee.getText() === "vi.stubEnv" && literal) {
        result.env.push({ name: first.getLiteralText(), line: node.getStartLineNumber() });
      }
      if (Node.isIdentifier(callee) && callee.getText() === "scenario") result.scenarios.push(readScenario(node));
    }
    if (Node.isPropertyAccessExpression(node) && SKIP_PROPERTIES.has(node.getName())) {
      const root = rootIdentifier(node.getExpression());
      if (root && RUNNERS.has(root)) result.skips.push({ name: node.getText(), line: node.getStartLineNumber() });
    }
    if (Node.isPropertyAssignment(node) && node.getName() === "env") {
      const value = node.getInitializer();
      if (value && Node.isObjectLiteralExpression(value)) {
        for (const property of value.getProperties()) {
          if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
            result.env.push({
              name: property.getName().replace(/^["']|["']$/g, ""),
              line: property.getStartLineNumber(),
            });
          }
        }
      }
    }
    if (Node.isBinaryExpression(node) && node.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
      const name = /^process\.env(?:\.(\w+)|\[["'](\w+)["']\])$/.exec(node.getLeft().getText());
      if (name) result.env.push({ name: (name[1] ?? name[2]) as string, line: node.getStartLineNumber() });
    }
  }
  return result;
}

function readScenario(call: CallExpression): TestScenario {
  const [idArg, body] = call.getArguments();
  const id = idArg && Node.isStringLiteral(idArg) ? idArg.getLiteralText() : null;
  const scenario: TestScenario = { id, line: call.getStartLineNumber(), steps: [] };
  if (!body) return scenario;
  const tainted = taint(body);
  for (const step of body.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = step.getExpression();
    const keyword = Node.isIdentifier(callee) ? STEP_KEYWORDS[callee.getText()] : undefined;
    if (!keyword) continue;
    const [label, stepBody] = step.getArguments();
    const assertions = stepBody ? assertionArguments(stepBody) : [];
    scenario.steps.push({
      keyword,
      label:
        label && (Node.isStringLiteral(label) || Node.isNoSubstitutionTemplateLiteral(label))
          ? label.getLiteralText()
          : null,
      line: step.getStartLineNumber(),
      assertions: assertions.length,
      assertsOnSut: assertions.some((args) => args.some((arg) => mentions(arg, tainted))),
    });
  }
  return scenario;
}

/** Names whose value comes from `sut` or `fakes`, followed through declarations and assignments. */
function taint(body: Node): Set<string> {
  const tainted = new Set(SOURCES);
  for (let changed = true; changed; ) {
    changed = false;
    const add = (names: string[]): void => {
      for (const name of names) {
        if (!tainted.has(name)) {
          tainted.add(name);
          changed = true;
        }
      }
    };
    for (const declaration of body.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const initializer = declaration.getInitializer();
      if (initializer && mentions(initializer, tainted)) add(bindingNames(declaration.getNameNode()));
    }
    for (const binary of body.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (binary.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
      if (mentions(binary.getRight(), tainted)) add(bindingNames(binary.getLeft()));
    }
  }
  return tainted;
}

function bindingNames(node: Node): string[] {
  if (Node.isIdentifier(node)) return [node.getText()];
  return node.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText());
}

function mentions(node: Node, names: Set<string>): boolean {
  if (Node.isIdentifier(node)) return names.has(node.getText());
  return node.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => names.has(identifier.getText()));
}

/** Argument lists of `expect(...)` and `assert(...)`/`assert.x(...)` calls. */
function assertionArguments(body: Node): Node[][] {
  return body
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => /^(expect|assert)(\.\w+)?$/.test(call.getExpression().getText()))
    .map((call) => call.getArguments());
}

function rootIdentifier(node: Node): string | undefined {
  let current = node;
  while (Node.isPropertyAccessExpression(current) || Node.isCallExpression(current)) current = current.getExpression();
  return Node.isIdentifier(current) ? current.getText() : undefined;
}

function scanPython(repo: Repo, files: string[]): TestFile[] {
  if (files.length === 0) return [];
  const script = join(dirname(fileURLToPath(import.meta.url)), "..", "py", "scan_tests.py");
  const run = spawnSync("python3", ["-I", script, ...files], { cwd: repo.root, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`Python test reader failed: ${run.stderr || run.error?.message}`);
  return JSON.parse(run.stdout) as TestFile[];
}
