---
status: accepted
date: 2026-11-09
---

# 0095. Each release moves the pins of the Compose profile and the Helm chart

## Context

`deploy/compose/compose.yaml` pins each module image and the npm packages in it, like
`intake:0.2.0` with `@opensoftware/intake@0.2.0`. The Helm chart repeats the tags in `values.yaml`, and the suites deploy
and e2e of `.github/test-suites.yml` repeat the third-party images in their `pull` lists. Nothing kept these places in
step, and nobody moved the pins after a release: on 9 November 2026 the profile ran intake 0.2.0 while 0.4.1 was
released, so the profile missed the durable events, the health routes and the traces of wave 5. The chart's version
was still 0.1.0 after many changes to it, and `publish-images` pushes a chart only for a version that GHCR does not
have, so GHCR served the first chart.

## Decision

- `osf profile-pins` writes the workspace's version of each `@opensoftware/<name>` into `compose.yaml`. A module image
  whose packages changed gets a new tag: the new version of its own module, or `<version>-r<n+1>` when only an adapter
  moved, because a published tag never changes. The chart's `images.*` take the same tags, and the chart's version
  moves by a patch when they change.
- `release-please.yml` runs `osf profile-pins` in the open release pull request after release-please updated it, and
  commits the result there. A release therefore moves the npm versions and the pins together.
- `publish-images` waits until npm serves each package that an image installs, since the `publish-<name>` workflows run
  at the same time.
- The check PROFILE fails when:
  - a line of `compose.yaml`, `values.yaml` or `Chart.yaml` differs from what `osf profile-pins` writes;
  - a module image's tag is not the version of its own package, with or without `-r<n>`;
  - compared with the base, an image's packages changed and its tag did not, or a chart file changed and the chart's
    version did not;
  - the chart names an image that the profile does not run;
  - a suite does not pull an image of the Compose files its tests start, or pulls an image that no file of its
    packages, or of the workspace packages they depend on, names.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The release pull request moves the pins (chosen) | The profile always runs the released modules; one check finds every place | Every release that changes a module of the profile publishes new images |
| Pins by hand, with a check that they agree | Images change only when a person wants | The profile falls behind, as it did |
| release-please `extra-files` with version markers | No step of our own | A marker sets one package's version per line; `PACKAGES` holds several packages in one line, and the tags need the `-r<n>` rule |
| A tag from a hash of the packages | No `-r<n>` counter | Tags that say nothing to the operator |

## Prior art

- release-please (Apache-2.0, ADR 0005): its `extra-files` with the `generic` updater were checked, not adopted, for the
  reason in the table.
- `osf release-files` (ADR 0037): the same pattern of one tool that writes files and one check that renders them again
  and compares.

## Consequences

- A merged release pull request publishes the npm packages and then the images and the chart of the new pins.
- A manual change of a pin fails PROFILE until the pin is the released version; a new package in an image needs its
  release first.
- The `pull` rule does not find an image that only code starts, like the gateways of inference-litellm: such an image
  must be named in the code, so a stale entry is found, but a missing one is not.
