// The two kinds of failure: a usage error (a wrong option, scorer or input file) exits 2 before any judge call.

export class UsageError extends Error {
  override name = "UsageError";
}
