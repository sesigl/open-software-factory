---
status: accepted
topic: design-note
date: 2026-11-17
---

# 0167. The kind jobs pull their images from the registries again; kind still starts in the background

## Context

ADR 0163 started kind in the background and loaded the kind node image and each kind suite's `pull` images from
`actions/cache` entries that `main` saves. It expected the deploy job's setup to fall from 112 s to 65 to 70 s. The
runs after it say otherwise. Setup is the time from the job's start to `make verify-tests`, in seconds:

| Runs | deploy | testkit | sandbox-kubernetes |
| --- | --- | --- | --- |
| Before 0163: 43987462100, 43990293428, 43993575818 (the runs 0163 measured) | 120, 112, 99 | 120, 116, 110 | 90, 94, 89 |
| Before 0163: the five next runs of `main`, 44005941657 to 44014906391 | 131, 136, 109, 133, 115 | 99, 114, 107, 127, 107 | 84, 116, 85, 98, 93 |
| Background start, cache miss: 44016415294 (push), 44016551088 (dispatch) | 107, 89 | 107, 92 | 87, 82 |
| Background start, cache hit: 44017577850 (pull request), 44019594220 (push), 44019765488 (dispatch) | 163, 155, 152 | 121, 115, 131 | 83, 88, 96 |

The medians of the eight runs before 0163 are 118, 112 and 92 s. Where the deploy job's time went:

- Without the cache, the background start (kind, its readiness, the agent-sandbox controller) took 76 and 66 s, and
  the step that waits for it waited 32 and 26 s, against 66 to 78 s for the kind step before 0163.
- With the cache, the restore of deploy's 1.2 GB of `pull` images sat on the path for 17 to 20 s, `docker load` of
  3.3 GB of images ran beside the kind start, and the background start took 120 to 148 s. `actions/setup-node` took
  24 to 28 s instead of 13 to 17 s. kind's own readiness rose to 28 and 39 s in two of the three runs.
- For testkit and sandbox-kubernetes the restored node image saved nothing: their wait for the cluster was 14 to 38 s
  with the hit, 20 to 36 s without it.

The background start's log came out at once, at the end of the step that waits for it, without times, so the runs do
not show how its 66 to 148 s split between kind and the controller.

The background start also applied the agent-sandbox manifest, and the action `kind-agent-sandbox` applied it a second
time ("unchanged") and waited again.

## Decision

- The image caches go: no `kind-node-…` or `kind-pull-…` entries, no `docker load` and no `docker save`. kind pulls
  its node image from its registry, and the suite's `pull` images are pulled in the background as before 0163.
- kind still starts in the background right after the pinned tools are restored
  (`.github/scripts/kind-start.sh`, which replaces `kind-images.sh`): without the cache it was 5 to 30 s faster for
  deploy and testkit and 5 to 10 s for sandbox-kubernetes.
- Each line of the background start's log carries the time of day it was written, so the next run shows where its
  time goes.
- The manifest of agent-sandbox is applied once: by the background start, or by `kind-start.sh wait agent-sandbox`
  when nothing started the cluster (the mutation shards). The action no longer applies it.
- This amends ADR 0163; its body stays as it was decided.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Drop the caches, keep the background start (chosen) | The fastest setup measured; less code | The registries stay on the path |
| Keep only the node image cache | Pins a smaller entry | It saved nothing for testkit and sandbox-kubernetes |
| Load the archives later, after the install | Less contention with the install | Deploy still waits for 3.3 GB to load before its tests |
| Drop the background start too | The same as before 0163 | Slower: 118 s median for deploy before, 89 and 107 s with it |

## Consequences

- Expected setup: the miss runs, about 90 to 107 s for deploy, 92 to 107 s for testkit and 82 to 87 s for
  sandbox-kubernetes, which is under the medians before 0163 but not under a minute. The pull request's own run and
  the next run of `main` measure it.
- The cache of the repository no longer holds about 1.6 GB of image archives; the entries that `main` saved expire.
- Revisit with the timed log of the background start: if the agent-sandbox controller's image pull inside the cluster
  or kind's readiness dominate, that is the next cause to fix.
