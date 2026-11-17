---
status: accepted
topic: factory
date: 2026-11-14
---

# 0140. Skills in the Agent Skills format, their needs in its metadata, and their rules in `factory lint`

## Context

T-59: a skill is a path in `factory.yaml` (`skills: [./skills/x]`), and `factory lint` checked only that the path
exists. Nothing said which secret or host a skill needs, so a skill failed inside a run, and the console cannot show
what switching a skill on asks for. ADR 0135 puts the rules of skills in `factory-spec`, which owns `factory.yaml`;
the console runs `factory lint` and `factory edit` as programs. The foreman gives each agent its skills by copying
their files into the session's folder as text (ADR 0112). Claude Code, Codex and OpenCode each read skills, so a
`SKILL.md` must stay valid for all three.

## Decision

- **The format is Agent Skills** (agentskills.io, the specification as of November 2026). A skill is a folder with a
  `SKILL.md`: YAML front matter between a first line `---` and the next line `---`, then a short Markdown body;
  details go into files beside it, which the agent reads when it needs them.
  - `name`: required; lowercase letters and digits with single hyphens between them
    (`^[a-z0-9]+(-[a-z0-9]+)*$`), at most 64 characters, equal to the folder's name.
  - `description`: required and not empty, at most 1024 characters: what the skill does and when to use it.
  - `compatibility`: optional, at most 500 characters. A length counts characters (code points), as the reference
    validator does.
  - `license`, `allowed-tools` and the fields of a harness (Claude Code's `disable-model-invocation`, `context` and
    others) are allowed and not checked.
  - `metadata`: optional; a mapping.
- **What the factory adds goes into `metadata`**, the format's place for clients' properties, under two keys:
  - `opensoftware/secrets`: the secrets the skill needs, by the variable that holds each in a sandbox (ADR 0068): the
    name of the reference in upper case, every character outside `A-Z` and `0-9` as `_`. So the skill says
    `LINEAR_TOKEN`, whichever provider the factory keeps it in, and `ref:openbao/linear-token` or `ref:env/LINEAR_TOKEN`
    gives it. A name has the form `^[A-Z0-9_]+$`.
  - `opensoftware/hosts`: the hosts the skill reaches, as entries of `sandbox.egress` (`^[a-z0-9-]+(\.[a-z0-9-]+)*$`).
  - Each value is **one text, names separated by spaces**: the format's metadata maps keys to text, and
    `allowed-tools` lists its names the same way. The prefix follows OpenCode's `opencode/autoinvoke`; the keys are
    reasonably unique, as the format asks.

  ```markdown
  ---
  name: release-notes
  description: Write the release notes of a change from its Linear issues. Use when a change ships.
  metadata:
    opensoftware/secrets: LINEAR_TOKEN
    opensoftware/hosts: api.linear.app uploads.linear.app
  ---

  # Release notes
  ```

- **The rules in `factory lint`**, for every skill an agent uses. A problem fails lint and every command that lints
  first (`render`, `plan`, `apply`, `edit`); a warning does not:

  | Rule | Kind | Why |
  | --- | --- | --- |
  | The folder has a `SKILL.md` | problem | Without it no harness finds the skill |
  | The front matter is there and parses as YAML | problem | Codex refuses the skill; Claude Code loads it without fields |
  | `name` fits the form and the limit and is the folder's name | problem | The foreman and `render` name the skill by its folder; Codex refuses a longer name |
  | `description` is there and inside its limit, `compatibility` inside its limit | problem | Codex refuses a skill without a description; no harness can choose it |
  | `metadata` is a mapping; each need is text with names of their form | problem | Codex refuses a `metadata` that is no mapping; a need that cannot be read would be lost |
  | Every file of the folder is UTF-8 text | problem | The foreman reads each file with `readFileSync(path, "utf8")` and writes the text (`filesBelow` in `modules/foreman/src/adapters/factory.ts`, `writeSkills` in `adapters/skills.ts`): a binary file arrives broken |
  | One name, one skill folder in a factory | problem | The foreman and `render` give an agent one folder per name; a second one replaces the first |
  | The agent declares a reference for each secret the skill needs | problem | The skill fails in the run |
  | A sandboxed agent's `egress` allows each host the skill needs | problem | The egress proxy refuses the host; an agent without a sandbox reaches every host, so it is asked for none |
  | `SKILL.md` has fewer than 500 lines | warning | The format recommends it; a longer file works, it costs context |

  A problem in a skill's own file names that file with its line and column (`skills/x/SKILL.md:2:1 ...`); a problem of
  the agent names the agent's skill entry in `factory.yaml`, the agent, the skill and what is missing, and says the
  fix: `agent "triage" lacks the secret LINEAR_TOKEN that its skill "release-notes" needs: add a reference such as
  "ref:<provider>/linear-token" to agents.triage.secrets`. `factory edit add-skill` refuses the same, so a program
  that switches a skill on adds the secret reference and the host first, each with its own edit.
- **Implemented in `factory-spec`, not run from the reference validator.** The rules of `skills-ref` are about 30
  lines; `factory-spec` implements them on `yaml`, the parser it reads `factory.yaml` with, and adds the factory's own
  rules (needs, text files, one name). The deviations from `skills-ref`, each on purpose: fields outside the format are
  allowed, because the harnesses define their own; YAML is YAML 1.2 as the harnesses parse it, with flow lists;
  a name is ASCII, the form OpenCode recommends for portable skills; only `SKILL.md` counts, not `skill.md`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The format's rules and the factory's in `factory-spec` on `yaml` (chosen) | No new dependency; one parser with places for every finding; the needs and per-agent rules need code of ours anyway | The rules follow a change of the specification by hand |
| Run `skills-ref validate` | The reference itself | Python and `strictyaml` beside a Node package; its README says it is for demonstration, not production; it refuses Claude Code's and OpenCode's fields; it cannot check needs |
| An npm port: `skills-ref` 0.1.5, `agent-skills-ts-sdk` 2.5.0 | JavaScript | One maintainer each, the first unchanged since December 2025; a dependency for 30 lines that still leaves our rules to write |
| Needs as YAML lists in `metadata` | Easier to read | The format's values are text: `skills-ref` turns a list into Python's `"['a', 'b']"` and refuses a flow list |
| Needs as fields of their own beside `name` | Short | `skills-ref`, claude.ai's upload and the Skills API refuse a field outside the format |
| Names separated by commas | Common in YAML | The format's own list in a text, `allowed-tools`, uses spaces |
| A binary file as a warning | A skill with an image still passes | The run gets a broken file without a word |

## Prior art

- **Agent Skills specification** (agentskills.io, an open format that Claude Code, Codex and OpenCode say they follow,
  active): read in full on agentskills.io/specification.md. Adopted as the format.
- **`skills-ref`** (Apache-2.0, `agentskills/agentskills`, version 0.1.0): read `validator.py` and `parser.py` from
  raw.githubusercontent.com and ran them with `strictyaml` 1.7 on sample skills. The example above passes, and its
  metadata reads as text (`'opensoftware/hosts': 'api.linear.app uploads.linear.app'`, `'opencode/autoinvoke':
  'false'`). A block list became `"['a.example', 'b.example']"`, a flow list did not parse, and
  `disable-model-invocation: true` failed with "Unexpected fields in frontmatter". Its rules are adopted; the tool is
  not run.
- **Claude Code** (proprietary; its skills documentation on code.claude.com): `metadata` is "a free-form YAML map"
  that Claude Code does not act on, and a value that is no map is dropped; keys must not reuse a field's name such as
  `paths`. Ours do not. Its own fields sit beside the format's; its uploads and the Skills API allow only the format's
  six fields.
- **Codex** (Apache-2.0, `openai/codex`): read `codex-rs/skills/src/parser.rs` on `main`. It parses the front matter
  with `serde_yaml` into `name`, `description` and `metadata.short-description`; other keys of `metadata` are ignored,
  and a `metadata` that is no mapping fails the parse. It refuses a missing description and a name over 64 characters.
- **OpenCode** (MIT, `sst/opencode`): read its skills documentation on opencode.ai. It puts its own key into `metadata`
  (`opencode/autoinvoke: false`), takes the skill's ID from the folder, and does not enforce the name's form, its
  match with the folder or the description's length. Its source was not readable here (github.com and its API answer
  403 to this session, and the guessed raw paths 404); that it ignores unknown `metadata` keys is taken from the
  documentation, which accepts portability fields without interpreting them.
- **`yaml`** (ISC, active), already a dependency of `factory-spec`: parses the front matter.

## Consequences

- A skill that a factory's agent cannot run fails `factory lint` before the run, with what to add. The console shows
  the same findings and adds a missing secret reference and host in one change (T-59's later slices).
- A program that reads the findings parses lines; a machine-readable form of `factory lint` is not built yet.
- The skills of this repository already follow the format and need nothing; a skill author who needs a secret or a
  host writes the two keys.
- A skill with an image or another binary file fails until the foreman copies bytes (ADR 0112).
- Revisit when the specification gives `metadata` structured values or names keys for secrets or network access, or
  when a harness starts to refuse unknown `metadata` keys.
