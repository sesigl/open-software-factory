// Two kinds of failure: a wrong command line exits 2 before anything is written; everything else exits 1.

export class UsageError extends Error {
  override name = "UsageError";
}

/** A usage error with the message unless the condition holds. */
export function usage(condition: unknown, message: string): asserts condition {
  if (!condition) throw new UsageError(message);
}
