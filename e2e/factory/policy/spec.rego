# The gate before the spec stage of the end-to-end factory: a maintainer approves every spec.
package gatekeeper

default risk := "medium"

approvers contains "maintainers"
