# The gate before the spec stage of the reference factory: a maintainer approves every spec.
package gatekeeper

default risk := "medium"

approvers contains "maintainers"
