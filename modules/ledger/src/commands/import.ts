// ledger import: read one repository's pull requests, reviews and comments from its forge and write them as pr.*
// events to a JSON Lines file that ingest reads (ADR 0036).

import { writeText } from "../adapters/files.ts";
import { forgeClient } from "../adapters/forge.ts";
import { pullEvents, type Repository } from "../domain/forge.ts";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Reads every list before it writes, so a forge error leaves no file. `since` is a day like 2026-01-31. */
export async function importForge(
  repository: Repository,
  options: { token: string | undefined; since: string | null; out: string },
): Promise<string> {
  const forge = forgeClient(repository, options.token);
  const since = options.since ? Date.parse(`${options.since}T00:00:00Z`) : Number.NEGATIVE_INFINITY;
  const pulls = await forge.pulls((pull) => Date.parse(pull.updated_at) >= since);
  const events = [];
  for (const pull of pulls.sort((a, b) => a.number - b.number))
    events.push(...pullEvents(repository, pull, await forge.reviews(pull), await forge.comments(pull)));
  writeText(options.out, events.map((event) => `${JSON.stringify(event)}\n`).join(""));
  return `wrote ${count(events.length, "event", "events")} of ${count(pulls.length, "pull request", "pull requests")} to ${options.out}`;
}
