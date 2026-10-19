#!/usr/bin/env node
// osf-contracts: validate documents against the shared formats, check schema compatibility with the last release,
// and round-trip the fixtures through the generated clients.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { breaking } from "./breaking.ts";
import { FORMATS, formatNamed } from "./formats.ts";
import { validate } from "./index.ts";
import { CLIENTS, roundtrip } from "./roundtrip.ts";

const USAGE = `Usage: osf-contracts <command>

  validate <format> <file>       check a YAML or JSON document; formats: ${FORMATS.map((format) => format.name).join(", ")}
  breaking [--base <ref>]        breaking schema changes since the last contracts-v* tag (or <ref>) without a major version
  roundtrip --client <client> [dir]
                                 load every valid fixture under dir (default contracts) with a generated client and
                                 compare what it writes back; clients: ${CLIENTS.join(", ")}
`;

function main(argv: string[]): number {
  const [command, ...args] = argv;
  switch (command) {
    case "validate":
      return validateCommand(args);
    case "breaking": {
      const at = args.indexOf("--base");
      return breaking(at === -1 ? undefined : args[at + 1]);
    }
    case "roundtrip": {
      const at = args.indexOf("--client");
      const client = at === -1 ? undefined : args[at + 1];
      const dir = args.filter((_, index) => index !== at && index !== at + 1)[0] ?? "contracts";
      if (!client || !(CLIENTS as readonly string[]).includes(client))
        return usage(`Give a client: ${CLIENTS.join(", ")}`);
      return roundtrip(client as (typeof CLIENTS)[number], dir);
    }
    case undefined:
    case "help":
    case "--help":
      process.stdout.write(USAGE);
      return command === undefined ? 2 : 0;
    default:
      return usage(`Unknown command: ${command}`);
  }
}

function validateCommand([name, file]: string[]): number {
  const format = name ? formatNamed(name) : undefined;
  if (!format || !file) return usage(name && !format ? `Unknown format: ${name}` : "Give a format and a file");
  let document: unknown;
  try {
    document = parse(readFileSync(file, "utf8"));
  } catch (error) {
    process.stdout.write(`${file}: not readable as YAML or JSON: ${(error as Error).message}\n`);
    return 1;
  }
  const problems = validate(format, document);
  for (const problem of problems) process.stdout.write(`${file} ${problem.path}: ${problem.message}\n`);
  if (problems.length > 0) return 1;
  process.stdout.write(`${file}: valid ${format.name}\n`);
  return 0;
}

function usage(message: string): number {
  process.stderr.write(`${message}\n\n${USAGE}`);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
