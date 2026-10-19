---
status: accepted
date: 2026-10-19
---

# 0013. No approval gates in the development of this repository

## Context

ADR 0011 and T-00 added gates that make agents wait for a person:

- a Claude Code `PreToolUse` hook (`osf protect-paths`) that refused edits to `contracts/`, `features/**`,
  `docs/quality/`, `tools/checks/` and `.github/workflows/` unless the person who started the session listed the
  path in `OSF_APPROVED_PATHS`;
- the SPECGUARD check, which failed a pull request that changed, deleted or deprecated an implemented scenario
  unless a code owner approved it;
- `.github/CODEOWNERS` and the rules in `AGENTS.md` and the skills that told agents to stop and ask a person
  before such a change.

The project is in its early phase with one developer, who reviews and merges every pull request. GitHub never
lets the author approve their own pull request, so SPECGUARD blocked that developer's own changes. Each gate
stopped work for a decision the pull request review already makes.

## Decision

Remove the gates. The review of the pull request is the approval.

- Delete the `PreToolUse` hook, `osf protect-paths`, `OSF_APPROVED_PATHS` and scenarios SCN-REPO-021 and
  SCN-REPO-022.
- Delete the SPECGUARD check, `OSF_APPROVALS` and the review download in `verify.yml`. Scenario SCN-REPO-007 is
  deprecated; SCN-REPO-025 replaces SCN-REPO-020 without SPECGUARD.
- Delete `.github/CODEOWNERS`.
- Agents change scenarios, contracts, checks and workflows themselves. They stop and ask only when a requirement
  is unclear, when a change needs a paid service or call, or when a check fails for a reason they cannot fix.
- An agent may write an ADR as `accepted` when its pull request makes the decision.

The quality rules stay: scenario first, one system test per scenario, never skip or weaken the test of an
implemented scenario, replace a scenario (`@replaces=`, old one `deprecated`) instead of editing its steps,
never write a credential, and every check of `docs/quality/checks.md` in `make verify`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Remove the gates | no waiting; the review already sees every change | a careless agent change is caught only in review |
| Keep the gates, approve paths per session | guards against unnoticed edits | blocks the only developer; GitHub forbids self-approval |
| Keep SPECGUARD as a warning | shows changed scenarios | the pull request diff shows them already |

## Prior art

No new module, dependency or service. GitHub branch protection can require reviews when the project has more
maintainers; that is a repository setting, not code in this repository.

## Consequences

Agents finish changes to protected areas without a second session. Changed implemented scenarios are visible
only in the diff and in the TRACE and STEPS checks. Revisit when a second maintainer or the factory itself
(phase 3) opens pull requests: then require reviews in branch protection, and let gatekeeper (`TODO.md`) decide
what needs a person.
