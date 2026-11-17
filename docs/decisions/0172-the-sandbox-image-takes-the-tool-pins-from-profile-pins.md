---
status: accepted
topic: install
date: 2026-11-17
---

# 0172. The sandbox image takes the repository's tool pins from osf profile-pins

## Context

The target `dogfood` of `deploy/images/Dockerfile` (ADR 0164) installed pnpm 10.28.0 and lychee 0.20.1, with the
SHA-256 sums of lychee's x86_64 and arm64 builds, as text of its own. The repository pins the same tools elsewhere:
pnpm in `packageManager` of the root `package.json`, lychee in `tools/scaffold/install-tools.ts`, which `make install`
reads. Nothing compared them, and SCN-DIST-070 named the versions too, so a new pin left the image on the old version
while every check passed. The arm64 sum had no second source in the repository at all.

`osf profile-pins` already writes the pins of `deploy/compose/compose.yaml` (ADR 0095), and PROFILE fails each line
that it would change. `publish-images` and the deploy suite both build the images with `docker buildx bake` from
`compose.yaml`, so a build argument of a service reaches every build of its image.

## Decision

- The target `dogfood` takes `PNPM_VERSION`, and the stage `lychee` takes `LYCHEE_VERSION`, `LYCHEE_SHA256_AMD64` and
  `LYCHEE_SHA256_ARM64`, as build arguments without defaults: a build without them stops.
- The service `dogfood-template` of `compose.yaml` passes them. `osf profile-pins` writes each build argument of that
  name in any service: `PNPM_VERSION` from `packageManager`, lychee's from its entry in `install-tools.ts`, the sums of
  its builds `linux-x64` and `linux-arm64`. `install-tools.ts` gets the build `linux-arm64` of lychee, so the arm64 sum
  has its one source there, and `make install` installs lychee on Linux arm64 too.
- A new pin gives the image a new tag, as a new package does: `<version>-r<n+1>`. Compared with `OSF_BASE`, PROFILE fails
  a changed tool pin of an image whose tag stayed the same, as the publish keeps the old image under an existing tag.
- SCN-DIST-070 compares the image's pnpm and lychee with the build arguments of `docker compose config` instead of
  naming the versions; PROFILE keeps the arguments equal to the pins.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A rule in PROFILE that compares the Dockerfile's text with the pins | No new build arguments | The versions stay in three places, each pin change is a hand edit of the Dockerfile |
| Build arguments that `osf profile-pins` writes (chosen) | One source per pin; the release mechanism moves the tag; the existing PROFILE rule finds every stale line | `compose.yaml` holds generated values; osf profile-pins must know the argument names |
| `scripts/images.ts` passes the pins with `--set` | Nothing generated in `compose.yaml` | `publish-images` bakes `compose.yaml` itself and would need the same code; the tag would not move |
| pnpm through corepack | Follows `packageManager` by itself | Rejected in ADR 0164: it downloads pnpm at the first use |

## Prior art

- Renovate's regex managers and Dependabot update version strings in Dockerfiles from a registry, not from another
  file of the same repository; neither keeps two files of one repository equal. `osf profile-pins` (ADR 0095) does,
  and this extends it by four argument names. Nothing new is installed.
- lychee publishes no checksum file with release `lychee-v0.20.1` that this session could read (its release API
  answered 403 here); the arm64 sum was checked against the archive downloaded from the release.

## Consequences

- Moving `packageManager` or lychee's pin makes PROFILE fail on `compose.yaml` until `osf profile-pins` runs; it writes
  the arguments and the image's next tag in the same step, and the next `publish-images` builds the new image.
- Another tool of the image needs its argument name in `toolPins` of `tools/checks/lib/profile.ts`.
- Revisit when the sandbox image installs every tool of `make install`: then it could run `install-tools.ts` itself.
