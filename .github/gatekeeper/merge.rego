# The merge gate of this repository (ADR 0047): a factory-made pull request needs a maintainer's "/approve".
# Other pull requests pass without a person; the review of the pull request is their approval (ADR 0013).
package gatekeeper

# The foreman's branches are osf/<run ID> (modules/foreman, branchOf); observer's are observer/.
factory_made if startswith(input.change.head, "osf/")

factory_made if startswith(input.change.head, "observer/")

factory_made if startswith(input.change.head, "factory/")

factory_made if "factory" in input.change.labels

default risk := "low"

risk := "high" if factory_made

approvers contains "maintainers" if factory_made
