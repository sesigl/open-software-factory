// Maps a path into the parsed factory.yaml to the line and column of its key, so every problem names its place.
import { type Document, isMap, isPair, isScalar, isSeq, type LineCounter, type Node } from "yaml";

export interface Place {
  line: number;
  column: number;
}

/** The place of the deepest key or item on the path that exists in the document. */
export function locate(document: Document, lines: LineCounter, path: string[]): Place {
  let node: unknown = document.contents;
  let offset = (node as Node).range?.[0] ?? 0;
  for (const key of path) {
    const child = isSeq(node)
      ? node.items[Number(key)]
      : isMap(node)
        ? node.items.find((pair) => isScalar(pair.key) && String(pair.key.value) === key)
        : undefined;
    if (!child) break;
    offset = ((isPair(child) ? child.key : child) as Node).range?.[0] ?? offset;
    node = isPair(child) ? child.value : child;
  }
  const { line, col } = lines.linePos(offset);
  return { line, column: col };
}

/** A JSON Pointer as path segments. */
export function segments(pointer: string): string[] {
  return pointer
    .split("/")
    .slice(1)
    .filter(Boolean)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}
