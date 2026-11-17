@module=deploy @owner=maintainers
Feature: The deploy suite starts the released images when it is told to
  On a pull request and on main, "scripts/images.ts" builds the module images of the commit under their pinned tags
  (ADR 0156). The workflow "released-images" runs after "publish-images" and starts the Compose scenarios on the images
  that the registry serves: with "OSF_DEPLOY_IMAGES=released" the script pulls each image of the factory's registry
  that "compose.yaml" pins and builds none (ADR 0169). A scenario that proves the images of the commit, like
  SCN-DIST-053, has the tag "@images=commit" and does not run there.

  @id=SCN-DIST-080 @status=implemented
  Scenario: With "OSF_DEPLOY_IMAGES=released", the dry run of "scripts/images.ts" pulls every image of the factory's registry that "compose.yaml" pins and builds none
    Given the Compose profile "compose/compose.yaml" with the images of the factory's registry that it pins
    When the operator runs "node scripts/images.ts --dry-run" with "OSF_DEPLOY_IMAGES=released"
    Then the command exits with code 0
    And the output has the line "images: docker pull <image>" once for each image of "ghcr.io/sesigl/open-software-factory/" that "compose.yaml" pins
    And the output has the line "images: the released images that compose.yaml pins, so none is built"
    And no line of the output names "images/.workspace" or a bake

  @id=SCN-DIST-081 @status=implemented
  Scenario: "scripts/images.ts" refuses a value of "OSF_DEPLOY_IMAGES" other than "commit" and "released"
    Given the Compose profile "compose/compose.yaml"
    When the operator runs "node scripts/images.ts --dry-run" with "OSF_DEPLOY_IMAGES=latest"
    Then the command exits with code 1
    And the error output contains "images: OSF_DEPLOY_IMAGES is commit (the default) or released, not latest"
