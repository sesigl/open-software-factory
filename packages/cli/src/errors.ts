// A usage error: a wrong option, argument or input file. The program exits 2 and writes nothing.

export class UsageError extends Error {}

/** Throws a usage error with the message unless the condition holds. */
export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new UsageError(message);
}
