// One line per changed value between two versions: "+ path: new", "- path: old" or "~ path: old -> new".

export function diff(before: unknown, after: unknown, path = ""): string[] {
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.flatMap((key) => diff(before[key], after[key], path ? `${path}.${key}` : key));
  }
  const [old, now] = [JSON.stringify(before), JSON.stringify(after)];
  if (old === now) return [];
  if (before === undefined) return [`+ ${path}: ${now}`];
  if (after === undefined) return [`- ${path}: ${old}`];
  return [`~ ${path}: ${old} -> ${now}`];
}

/** "Plan: 1 to add, 2 to change, 0 to remove, 0 drifted." */
export function summary(lines: string[]): string {
  const count = (sign: string): number => lines.filter((line) => line.startsWith(`${sign} `)).length;
  return `Plan: ${count("+")} to add, ${count("~")} to change, ${count("-")} to remove, ${count("!")} drifted.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
