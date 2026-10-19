// Reads the YAML files of "factory render --k8s" as lines, so a test can assert on one field at a time.

/** The lines of a rendered file without trailing spaces. */
export const lines = (text: string): string[] => text.split("\n").map((line) => line.trimEnd());
