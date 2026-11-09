---
status: accepted
date: 2026-11-09
---

# 0096. The agents of the Compose profile run in Docker sandboxes, with no token of the foreman

## Context

The Compose profile runs each stage's agent in the foreman's container, with the foreman's forge and model tokens in
its environment (TODO.md T-23, principle P11). The foreman can already run an agent in a sandbox (ADR 0068): the
docker sandbox adapter starts a container on an internal network whose only way out is an iron-proxy (ADR 0054),
and the sandbox holds a placeholder for each secret, which the proxy swaps for the real value on the way out.

Three things stop the profile from using it:

- The foreman runs in a container. The adapter calls the Docker CLI, so the foreman needs the Docker API of the host.
- The agents of the reference factory clone, push and open pull requests with `gh`. gh sends its token as a header
  to the API, which iron-proxy swaps, but git over HTTPS sends it as Basic credentials, base64 of
  `x-access-token:<token>`, in which the placeholder is not visible. Measured against github.com on 9 November 2026:
  git over HTTPS refuses a token in an `Authorization: Bearer` or `Authorization: token` header, and accepts it only
  as Basic credentials.
- The sandbox needs an image with the harness, and a way to the profile's LiteLLM.

## Decision

- **Git's Basic credentials.** The egress proxy's start script writes each secret from a file or a variable also in
  git's Basic form, base64 of `x-access-token:<secret>`, to `/osf/basic/`. The proxy configuration swaps the
  placeholder's Basic form, base64 of `x-access-token:<placeholder>`, for it in the header `Authorization`, for the
  hosts of `egress` only. With `GH_TOKEN` set to the placeholder, gh sends that exact form for git, so clone, fetch
  and push work without the token in the sandbox. A secret from OpenBao has no Basic form: the proxy fetches it only
  when a request needs it. This is in `@opensoftware/sandbox-egress`, so both sandbox adapters have it.
- **The Docker API.** A socket proxy, wollomatic/socket-proxy, holds the host's Docker socket and gives the foreman
  only the API paths that the docker sandbox adapter calls, and no bind mounts: the adapter copies files with
  `docker cp` and needs none.
- **The template.** The image `harness-claude-code`, built from `deploy/images/Dockerfile` with gh, make and the
  harness adapter, is the agents' template. `osf profile-pins` moves its pin with each release, also in
  `factory.yaml`, and PROFILE checks it (ADR 0095).
- **The model.** The sandbox's egress proxy joins the profile's network (`OSF_SANDBOX_NETWORK`) and reaches LiteLLM
  with the run's own key, which the foreman makes for each run (ADR 0080); the master key stays with the foreman.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Basic form computed by the proxy (chosen) | The token stays out of the sandbox and out of the foreman's memory; one place for both adapters | GitHub's user name `x-access-token`; a forge that checks the user name needs its own form |
| Git with the token in a plain header (`http.extraHeader`) | No change to the proxy | GitHub refuses it, measured |
| The foreman clones and pushes for the agent | The agent needs no forge token | A new step in the foreman around every stage; the agents' prompts change; `gh pr checkout` and the API calls still need a token |
| The adapter computes the Basic form | No change to the start script | The adapter would read the secret, which it never does |

| Option for the Docker API | For | Against |
| --- | --- | --- |
| wollomatic/socket-proxy (chosen) | MIT, three years of steady releases, 14 contributors; an allowlist of API paths by regular expression, and bind mounts off | Does not read the request body, so it cannot refuse a privileged container |
| Sockguard | Reads the request body: refuses privileged containers, host networking and bind mounts | Started in March 2026; nearly all commits by one author |
| Tecnativa docker-socket-proxy | The most widely used | Only API sections on or off; one merged change since May 2026 |
| The Docker socket in the foreman's container | Nothing to add | The foreman is root on the host |
| Docker in Docker | The host's Docker stays apart | A privileged container, and every image pulled twice |

## Prior art

- iron-proxy 0.54.0 (Apache-2.0, ADR 0054): its `secrets` transform swaps a proxy token in headers, the body, the query
  or the path, from a file or a variable; it does not decode Basic credentials. Adopted further, with a file per
  Basic form.
- gh 2.x (MIT): its git credential helper sends the user name `x-access-token` and the token as the password.
- wollomatic/socket-proxy 1.13.2 (MIT, maintained), Sockguard 2.4.6 (MIT, maintained), Tecnativa
  docker-socket-proxy 0.5.0 (Apache-2.0): compared on 9 November 2026 by age, contributors, merged changes and open
  issues; the table gives the result.

## Consequences

- The first slice, git's Basic credentials, ships on its own: `SCN-SANDBOX-023` proves it with each adapter's real
  proxy, `SCN-SEGRESS-022` the configuration.
- A compromised foreman can still create a privileged container through the socket proxy. Revisit when Sockguard has
  more than one regular maintainer, or when wollomatic/socket-proxy reads the request body.
- Forgejo accepts the token with the user name `x-access-token`, so the same Basic form works for it: `SCN-E2E-006`
  pushes to Forgejo from a sandbox. A forge that checks the user name needs its own Basic form.
