// The command line of each adapter of a port that is a program, and the versions a run asks for (ADR 0110): a map of
// FOREMAN_HARNESSES, FOREMAN_SANDBOXES, FOREMAN_FORGES or FOREMAN_INFERENCES names it as a JSON list of arguments or
// as a string split at each space; else npx runs the adapter's package at the range under the factory's `providers`.
import type { RunView } from "@opensoftware/contracts";

export type AdapterVersion = NonNullable<RunView["adapters"]>[number];
export type Port = AdapterVersion["port"];
export const PORTS: Port[] = ["harness", "sandbox", "forge", "inference"];

/** A map entry: the program and its arguments, or a string of them split at each space. */
export type CommandLines = Record<string, string | string[]>;

/** The variable of each port's map. */
export const MAP_OF: Record<Port, string> = {
  harness: "FOREMAN_HARNESSES",
  sandbox: "FOREMAN_SANDBOXES",
  forge: "FOREMAN_FORGES",
  inference: "FOREMAN_INFERENCES",
};

/** The ranges under the factory's `providers`, per port and adapter name. */
export type Ranges = Partial<Record<Port, Record<string, string>>>;

/** npx with the adapter's package at the range, if the factory declares one; a harness adapter's command is `run`. */
export function fallbackOf(port: Port, name: string, range?: string): string[] {
  const command = port === "harness" ? ["run"] : [];
  return ["npx", "-y", `@opensoftware/${port}-${name}${range ? `@${range}` : ""}`, ...command];
}

/**
 * The command line of an adapter: its map's entry, or the fallback at the factory's range; a run that started before
 * ADR 0110 has no ranges.
 */
export function commandOf(lines: CommandLines, port: Port, name: string, ranges: Ranges | undefined): string[] {
  const line = lines[name];
  if (line === undefined) return fallbackOf(port, name, ranges?.[port]?.[name]);
  return typeof line === "string" ? line.split(" ") : line;
}

/** Every adapter under the factory's `providers`, with the range it asks for and where its command line comes from. */
export function adaptersOf(ranges: Ranges, maps: Record<Port, CommandLines>): AdapterVersion[] {
  return PORTS.flatMap((port) =>
    Object.entries(ranges[port] ?? {}).map(([name, version]) =>
      name in maps[port]
        ? { port, name, version, configured: MAP_OF[port] }
        : { port, name, version, command: fallbackOf(port, name, version) },
    ),
  );
}
