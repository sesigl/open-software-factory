// The rules of the views, without I/O: the run states, the order of a merged run list, a run's age, and the links
// built from the configuration's URL templates (ADR 0072).
import type { RunView } from "@opensoftware/contracts";

export const STATES = ["running", "blocked", "complete", "failed", "cancelled"] as const;
export type RunState = (typeof STATES)[number];

export const isState = (value: string): value is RunState => (STATES as readonly string[]).includes(value);

/** The time a run counts from in the list: its end once it ended, else its start. */
const sortTime = (run: RunView): number => Date.parse(run.endedAt ?? run.startedAt);

/** Runs that have not ended first, the one that started last first; then the ended ones, the one that ended last first. */
export function orderRuns(runs: RunView[]): RunView[] {
  return [...runs].sort((a, b) => Number(Boolean(a.endedAt)) - Number(Boolean(b.endedAt)) || sortTime(b) - sortTime(a));
}

const UNITS: [number, string][] = [
  [86_400, "d"],
  [3_600, "h"],
  [60, "min"],
];

/** The time from `since` to `now` in its largest whole unit, like "5 min". */
export function age(since: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  const [size, unit] = UNITS.find(([size]) => seconds >= size) ?? [1, "s"];
  return `${Math.floor(seconds / size)} ${unit}`;
}

/** The template with each `{name}` replaced by its value, encoded for a URL. */
export const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? encodeURIComponent(values[name] as string) : whole,
  );

/** A comma-separated list, without empty entries. */
export const list = (text: string | undefined): string[] =>
  (text ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export interface NamedLink {
  name: string;
  url: string;
}

/** `name=url` entries, comma-separated. */
export const namedLinks = (text: string | undefined): NamedLink[] =>
  list(text).map((entry) => {
    const at = entry.indexOf("=");
    return { name: entry.slice(0, at), url: entry.slice(at + 1) };
  });
