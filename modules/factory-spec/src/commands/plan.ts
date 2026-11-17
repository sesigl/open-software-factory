// "factory plan" and "factory apply": pin registry servers in factory.lock, compare with the applied state, apply.
import { join, normalize } from "node:path";
import { maxSatisfying } from "semver";
import { hashOf, readText, sha256, writeLock } from "../adapters/files.ts";
import { packageVersions } from "../adapters/npm.ts";
import { versionsOf } from "../adapters/registry.ts";
import { readState, writeState } from "../adapters/state.ts";
import { diff, summary } from "../domain/diff.ts";
import { FactoryError, fail } from "../domain/errors.ts";
import { PROGRAM_PORTS, registryReferences, staleLock } from "../domain/lock.ts";
import { type AdapterPin, type Lock, type LockEntry, parseReference } from "../domain/mcp.ts";
import { resolveDefinition } from "../domain/resolve.ts";
import { type Factory, lintFile } from "./load.ts";
import { pinSkills } from "./pins.ts";
import { type RenderOptions, render } from "./render.ts";
import { applyWebhooks, webhookDrift } from "./webhooks.ts";

/**
 * factory.lock with an entry for every registry server: kept from the lock, or pinned from the registry once. With
 * `adapters`, every adapter of the ports the foreman runs as programs too (ADR 0125); without, the lock's adapter pins
 * stay as they are. Every skill of another repository is pinned, or kept while its entry is unchanged, and the rules
 * of lint check its fetched files before factory.lock is written (ADR 0146).
 */
export async function pin(factory: Factory, adapters = false): Promise<Factory> {
  const references = registryReferences(factory.definition);
  const lock: Lock = { version: 1, mcp: {} };
  for (const reference of references)
    lock.mcp[reference] = factory.lock.mcp[reference] ?? (await fromRegistry(reference));
  const pins = adapters ? await pinAdapters(factory) : factory.lock.adapters;
  if (pins) lock.adapters = pins;
  const skills = await pinSkills(factory.definition, factory.lock);
  if (Object.keys(skills.pins).length > 0) {
    lock.skills = skills.pins;
    const { problems } = lintFile(factory.file, false, undefined, skills.folders);
    if (problems.length > 0) throw new FactoryError(problems.join("\n"));
  }
  if (references.length > 0 || pins || lock.skills) writeLock(factory.dir, lock);
  return { ...factory, lock };
}

/** Each adapter's pin: kept while its range is unchanged, else the newest npm version inside the range. */
async function pinAdapters(factory: Factory): Promise<Record<string, Record<string, AdapterPin>>> {
  const pins: Record<string, Record<string, AdapterPin>> = {};
  for (const port of PROGRAM_PORTS)
    for (const [name, range] of Object.entries(factory.definition.providers?.[port] ?? {})) {
      const kept = factory.lock.adapters?.[port]?.[name];
      pins[port] ??= {};
      pins[port][name] =
        kept?.range === range ? kept : { range, version: await fromNpm(`@opensoftware/${port}-${name}`, range) };
    }
  return pins;
}

async function fromNpm(name: string, range: string): Promise<string> {
  return (
    maxSatisfying(await packageVersions(name), range) ??
    fail(`the npm registry has no version of "${name}" that matches "${range}"`)
  );
}

async function fromRegistry(reference: string): Promise<LockEntry> {
  const { name, range } = parseReference(reference);
  const published = await versionsOf(name);
  const version =
    maxSatisfying(
      published.map((server) => server.version),
      range,
    ) ?? fail(`the MCP Registry has no version of "${name}" that matches "${range}"`);
  const server = published.find((candidate) => candidate.version === version);
  const found = server?.packages?.find((candidate) => candidate.registryType === "npm");
  if (found)
    return { name, version, package: { registryType: "npm", identifier: found.identifier, version: found.version } };
  const remote = server?.remotes?.[0] ?? fail(`"${name}@${version}" has neither an npm package nor a remote`);
  return { name, version, remote: { type: remote.type, url: remote.url } };
}

/** What plan compares: the resolved definition and the hash of every prompt. */
function model(factory: Factory): Record<string, unknown> {
  const prompts = Object.fromEntries(
    Object.values(factory.definition.agents).map((agent) => [
      normalize(agent.prompt),
      sha256(readText(join(factory.dir, agent.prompt))),
    ]),
  );
  return { ...resolveDefinition(factory.definition, factory.lock), prompts };
}

/** "factory plan --check": one line per pin that factory.lock lacks, none when it is current. It writes nothing. */
export const checkLock = (factory: Factory): string[] => staleLock(factory.definition, factory.lock);

export async function plan(loaded: Factory, output: string, adapters = false): Promise<string[]> {
  const factory = await pin(loaded, adapters);
  const state = readState();
  // What factory.lock pins anew for a skill of another repository, and each pin that moves: old commit, new commit.
  const pinned = diff(loaded.lock.skills ?? {}, factory.lock.skills ?? {}, "factory.lock.skills");
  const changes = [...pinned, ...diff(state?.model ?? {}, model(factory))];
  const drift = Object.entries(state?.files ?? {})
    .filter(([path, hash]) => hashOf(output, path) !== hash)
    .map(([path]) => `! ${path} changed outside "factory apply"`);
  const lines = [...changes, ...drift, ...(await webhookDrift(state?.hooks))];
  return lines.length > 0 ? [...lines, "", summary(lines)] : ["No changes."];
}

export async function apply(loaded: Factory, output: string, options: RenderOptions): Promise<string> {
  const factory = await pin(loaded);
  const { files } = await render(factory, output, options);
  const applied = model(factory);
  const hooks = await applyWebhooks(factory.definition, readState()?.hooks, options.ghAw);
  writeState({ model: applied, files, hooks });
  return `Applied factory ${factory.definition.factory}, digest ${sha256(JSON.stringify(applied))}`;
}
