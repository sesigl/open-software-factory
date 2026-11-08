#!/usr/bin/env bash
# Installs OPA 1.21.0 through the GitHub API when setup-opa could not download it from github.com, and checks the file
# against its pinned SHA-256. Does nothing when OPA 1.21.0 is on the PATH. Used by action.yml only.
set -euo pipefail
if command -v opa >/dev/null && opa version 2>/dev/null | grep -q '^Version: 1\.21\.0$'; then exit 0; fi
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) name=opa_linux_amd64_static sha=5eef70644868bb04d0556bcc795ee42f2ab379e73f51d1bfa30f83e1305bc9b9 ;;
  Linux-aarch64) name=opa_linux_arm64_static sha=0ec34027c15b4d969c21d01ed570fe14fbebd508a08157043ab09f9a0dccbee6 ;;
  Darwin-arm64) name=opa_darwin_arm64_static sha=f1e4da6467a2adb2846bb23eec6ea00d8c3a04786f9270bb11003d22dfd827a5 ;;
  *) echo "gatekeeper: no pinned OPA build for $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac
api=https://api.github.com/repos/open-policy-agent/opa/releases
auth=(-H "Authorization: Bearer ${GH_TOKEN}")
id=$(curl -sSfL --retry 2 "${auth[@]}" "$api/tags/v1.21.0" | jq -r --arg name "$name" '.assets[] | select(.name == $name) | .id')
dir="${RUNNER_TEMP:-/tmp}/opa"
mkdir -p "$dir"
curl -sSfL --retry 2 "${auth[@]}" -H "Accept: application/octet-stream" -o "$dir/opa" "$api/assets/$id"
echo "$sha  $dir/opa" | shasum -a 256 -c - >/dev/null
chmod 755 "$dir/opa"
echo "$dir" >> "$GITHUB_PATH"
echo "gatekeeper: OPA 1.21.0 came through the GitHub API"
