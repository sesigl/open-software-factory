---
covers: [tools/scaffold/setup.ts, deploy/compose/.env.example, deploy/compose/compose.yaml, deploy/compose/factory/**]
---

# Your first factory run

This tutorial takes you from a clone of this repository to a healthy factory on one machine, and to its first run
on an issue. The commands are thin wrappers around
`docker compose` ([ADR 0119](../decisions/0119-setup-commands-around-compose.md)); the
[quick start](../../deploy/README.md#quick-start) shows the plain Compose commands.

## What you need

- Docker with Compose 2.24 or later, and Node 24.
- A GitHub repository for the factory to work on, and a fine-grained token for it: Contents, Issues and Pull requests
  write, Commit statuses write, Checks read.
- A model: a Claude subscription (`claude setup-token`) or a model key that you add to
  `deploy/compose/litellm/config.yaml`.

## 1. Create the configuration

```sh
git clone https://github.com/sesigl/open-software-factory.git
cd open-software-factory
node tools/bin/osf.ts init --factory team/factory
```

`osf init` writes `deploy/compose/.env`. It generates the secrets that only the factory's own services share: the
database password, the LiteLLM master key, the API tokens of foreman, intake and gatekeeper, and the unseal key and
the three tokens of OpenBao, the store of your agents' secrets. With `--factory`, it copies the reference factory to
`team/factory/` and points `FACTORY_DIR` there, so you change your copy. It ends with the list of values that are
still empty. `.env` stays out of Git; never commit it, and keep a copy in your safe: without its
`OSF_OPENBAO_UNSEAL_KEY`, no one can read the secrets you store. On an existing `.env`, `osf init` changes no value
and only adds the ones a newer profile generates.

## 2. Say who approves and where

Open `deploy/compose/.env` and set what your factory uses:

- `GATEKEEPER_FORGE_TOKEN` and `FOREMAN_FORGE_TOKEN` to your GitHub token, so gates ask on pull requests and foreman
  reads their checks. For Slack instead, set `GATEKEEPER_SLACK_CHANNEL`, `GATEKEEPER_SLACK_TOKEN` and
  `GATEKEEPER_SLACK_SIGNING_SECRET`.
- `GH_TOKEN` to the same token, so the agents clone and open pull requests.
- `CLAUDE_CODE_OAUTH_TOKEN` to the token of `claude setup-token`.

Then put the people who approve in `team/factory/groups.json`, in place of `slack:U0EXAMPLE`: `github:<login>` for
gates on pull requests, or a Slack member ID like `slack:U024BE7LH`.

## 3. Start the factory

```sh
node tools/bin/osf.ts up
```

`osf up` checks `.env` first and names each value that is missing. Then it runs `docker compose up --detach --wait`
in `deploy/compose/` and returns when every service is healthy. The first start pulls the module images.

## 4. Check it

```sh
node tools/bin/osf.ts doctor
```

`osf doctor` runs `console doctor` in the profile: one line per check, `ok` or `FAIL` with what to do, and the count
last. Fix each `FAIL`, run `osf up` again when you changed `.env`, and repeat until it prints `all ... checks ok`.
Then open the console at http://localhost:8080. It is open and read-only to anyone who reaches that address.

## 5. Turn on the sign-in

So that only your team gets in, the console signs people in with Google or GitHub:

1. Register the console with the callback `http://localhost:8080/signin/callback`: at Google as an OAuth client of
   the type "Web application", or at GitHub as an OAuth App (Settings → Developer settings → OAuth Apps).
2. In `deploy/compose/.env`, set `CONSOLE_SIGN_IN=oidc` with `CONSOLE_OIDC_ISSUER=https://accounts.google.com`,
   `CONSOLE_OIDC_CLIENT_ID` and `CONSOLE_OIDC_CLIENT_SECRET`, or `CONSOLE_SIGN_IN=github` with
   `CONSOLE_GITHUB_CLIENT_ID` and `CONSOLE_GITHUB_CLIENT_SECRET`. `osf init` already generated
   `CONSOLE_SESSION_SECRET`.
3. In `team/factory/access.yaml`, put your email in place of `admin@example.com`, with the role `admin`. Add your
   team with the role `member`.
4. Run `osf up`: it names each setting the provider still needs. Then `osf doctor`: its check `access` fails until
   an admin of yours is listed.

Open http://localhost:8080 and sign in. Use `localhost`, not `127.0.0.1`: the other tools of the profile run on
`127.0.0.1`, so they never get the console's cookie. See [Turn on the sign-in](../../deploy/README.md#turn-on-the-sign-in)
for the details.

Signed in as an admin, you store the values of your agents' secrets on the page `/secrets`: an agent that declares
`ref:openbao/<name>` gets the value in its next run, with no restart and no edit of `.env`. See
[Secrets in OpenBao](../../deploy/README.md#secrets-in-openbao), also for the backup of the store.

## 6. Give it work

Send intake an issue of your repository: see
[Receive GitHub issues on your machine](../../deploy/README.md#receive-github-issues-on-your-machine) in the deploy guide for the webhook. The console shows
the run, its stages and its gates; the first gate asks the people of your `groups.json`.

## Next

- Change the prompts, the policy and the stages in `team/factory/`; each `osf up` commits the folder, so a run's
  factory version is a commit. See [Your factory](../../deploy/README.md#your-factory).
- Stop the factory with `docker compose down` in `deploy/compose/`; the volumes keep its data.
