# The gate before the implement stage of the dogfood factory: a maintainer approves the spec on its pull request.
package gatekeeper

default risk := "medium"

approvers contains "maintainers"
