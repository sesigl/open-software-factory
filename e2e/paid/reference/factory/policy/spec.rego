# The gate before the stage implement of the reference factory: a maintainer approves every spec, on its pull
# request, before implement starts.
package gatekeeper

default risk := "medium"

approvers contains "maintainers"
