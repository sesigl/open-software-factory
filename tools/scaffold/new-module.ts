// `make new-module NAME=x`: copies the working module modules/_template (ADR 0015), renames it and its scenario
// prefix, registers the prefix in docs/reference/scenario-prefixes.md and generates the README sections.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { refreshDocs } from "./docs.ts";

const PREFIX_FILE = "docs/reference/scenario-prefixes.md";

export function newModule(root: string, args: string[]): number {
  const name = args.find((arg) => !arg.startsWith("--"));
  const option = (key: string): string | undefined => {
    const index = args.indexOf(`--${key}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const prefix = option("prefix") ?? name?.toUpperCase().replaceAll("-", "");

  if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) return fail("Give a module name in kebab case: osf new-module <name>");
  if (!prefix || !/^[A-Z][A-Z0-9]*$/.test(prefix)) return fail(`Not a valid scenario prefix: ${prefix}`);

  const template = join(root, "modules/_template");
  const target = join(root, "modules", name);
  if (!existsSync(template)) return fail("modules/_template is missing");
  if (existsSync(target)) return fail(`modules/${name} already exists`);

  const prefixFile = join(root, PREFIX_FILE);
  const table = existsSync(prefixFile) ? readFileSync(prefixFile, "utf8") : "";
  if (new RegExp(`^\\|\\s*${prefix}\\s*\\|`, "m").test(table))
    return fail(`The prefix ${prefix} is already registered`);

  // The template's own names: its folder, its package and bin name, and its scenario prefix.
  const fill = (text: string): string =>
    text
      .replaceAll("modules/_template", `modules/${name}`)
      .replaceAll("module-template", name)
      .replaceAll("SCN-TEMPLATE-", `SCN-${prefix}-`);
  for (const file of listFiles(template)) {
    const path = relative(template, file).replaceAll("SCN-TEMPLATE-", `SCN-${prefix}-`);
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), fill(readFileSync(file, "utf8")));
  }

  const row = `| ${prefix} | ${name} | \`modules/${name}/features/\` |`;
  const lines = table.split("\n");
  const last = lines.findLastIndex((line) => line.startsWith("|"));
  if (last < 0) {
    lines.push("| Prefix | Owner | Path |", "| --- | --- | --- |", row);
  } else {
    lines.splice(last + 1, 0, row);
  }
  mkdirSync(dirname(prefixFile), { recursive: true });
  writeFileSync(prefixFile, lines.join("\n").replace(/\n*$/, "\n"));

  refreshDocs(root, { write: true, only: [`modules/${name}/README.md`] });
  process.stdout.write(
    `Created modules/${name} with prefix SCN-${prefix}.\nNext: fill in README.md and AGENTS.md, then write SCN-${prefix}-001 (skills/write-scenario).\n`,
  );
  return 0;
}

function fail(message: string): number {
  process.stderr.write(`${message}\n`);
  return 1;
}

/** The template's source files, without installed packages and build output. */
function listFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .filter((entry) => !["node_modules", "dist", ".turbo"].includes(entry))
    .flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? listFiles(full) : [full];
    });
}
