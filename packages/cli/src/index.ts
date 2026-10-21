// @opensoftware/cli: what the command lines of the modules share. Modules import only from here.
export { check, UsageError } from "./errors.ts";
export { type Input, outputPath, packageVersion, readInputs, writeText } from "./files.ts";
export { type Command, type Io, type Outcome, type Program, runProgram } from "./program.ts";
