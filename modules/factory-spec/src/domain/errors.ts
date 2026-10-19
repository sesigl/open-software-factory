// The one error the module reports to the user: its message is printed as is and the command exits with code 1.

export class FactoryError extends Error {}

/** Throws a FactoryError; usable as an expression, for example `value ?? fail("...")`. */
export function fail(message: string): never {
  throw new FactoryError(message);
}
