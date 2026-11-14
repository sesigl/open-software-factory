@module=ui @owner=maintainers
Feature: Tokens and brand
  The design system ships its tokens as CSS custom properties for a dark and a light theme, and the brand as SVG
  files (ADR 0133). A page names the tokens; it never names a raw colour or a font.

  @id=SCN-UI-001 @status=implemented
  Scenario: The tokens define the dark theme and the same colours again for the light theme
    Given the files of "@opensoftware/ui"
    When a page reads the tokens of "files.tokens"
    Then the dark theme defines the backgrounds, lines, texts, the signal, the five states, the two faces, the type sizes, the spaces, the radii and the motion
    And the light theme defines every colour of the dark theme again, and no other name

  @id=SCN-UI-002 @status=implemented
  Scenario: The brand files hold the approved icon
    Given the files of "@opensoftware/ui"
    When a page reads the icon, the wordmark and the favicon
    Then each is an SVG with the path "M4 27V15l8-6v6l8-6v6l8-6v18H4zM14 27v-5h4v5h-4z" filled with the even-odd rule
    And the icon and the wordmark are named "Open Software Factory" and take the colour of the text around them
