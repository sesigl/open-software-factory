// A usage error (a wrong option or input record) exits 2 before anything is written.

export class UsageError extends Error {
  override name = "UsageError";
}

/** Throws a usage error with the message unless the condition holds. */
export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new UsageError(message);
}
