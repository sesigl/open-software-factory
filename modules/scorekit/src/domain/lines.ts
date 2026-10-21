// JSON Lines: one JSON value per non-empty line.
import { UsageError } from "@opensoftware/cli";

/** The values of a JSON Lines text with their line numbers. A line that is not JSON exits 2 with file and line. */
export function jsonLines(file: string, text: string): { line: number; value: unknown }[] {
  return text.split("\n").flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [{ line: index + 1, value: JSON.parse(line) as unknown }];
    } catch {
      throw new UsageError(`${file}:${index + 1}: not a JSON line`);
    }
  });
}
