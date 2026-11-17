# factory-test-repo

The scratch repository of the factory's rehearsal on GitHub: a tiny Node library that the factory of
[open-software-factory](https://github.com/sesigl/open-software-factory) changes with its scripted agent, so no model
is called ([ADR 0173](https://github.com/sesigl/open-software-factory/blob/main/docs/decisions/0173-a-rehearsal-on-github.md)).
Keep nothing here that matters: each rehearsal opens an issue, a branch `osf/<run ID>` and a pull request, all
labeled `rehearsal`.

- `npm test` runs the tests with `node --test`; they need no install.
- `.github/workflows/verify.yml` runs them on every pull request as the check `verify`, and attaches their JUnit
  report with proof as the commit status `proof`, the two checks the factory's stages `verify` and `ship` wait for.
- `.github/workflows/rehearsal.yml` is the rehearsal: Actions → rehearsal → Run workflow. How to set it up and what
  to check is in [deploy/README.md](https://github.com/sesigl/open-software-factory/blob/main/deploy/README.md#the-rehearsal).
