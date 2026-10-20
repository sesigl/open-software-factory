// The next free ID of a prefix. IDs are never reused, so it follows the highest one, deprecated scenarios included.

/**
 * `ids` are every ID in the feature files. Without an ID of the prefix yet, the first ID comes from the pattern:
 * its first group becomes the prefix and its `\d{N}` the number 1 with N digits.
 */
export function nextId(prefix: string, pattern: RegExp, ids: string[]): string {
  const own = ids.filter((id) => pattern.exec(id)?.[1] === prefix);
  const highest = own.map((id) => /(\d+)\D*$/.exec(id)).sort((a, b) => Number(b?.[1]) - Number(a?.[1]))[0];
  if (highest) {
    const digits = highest[1] as string;
    const next = String(Number(digits) + 1).padStart(digits.length, "0");
    return `${highest.input.slice(0, highest.index)}${next}${highest.input.slice(highest.index + digits.length)}`;
  }
  const first = pattern.source
    .replace(/^\^|\$$/g, "")
    .replace(/\([^)]*\)/, prefix)
    .replace(/\\d\{(\d+)\}/, (_, width: string) => "1".padStart(Number(width), "0"));
  if (pattern.exec(first)?.[1] !== prefix)
    throw new Error(`cannot build a first ID for ${prefix} from ${pattern.source}`);
  return first;
}
