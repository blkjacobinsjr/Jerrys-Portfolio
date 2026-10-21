Feature: Getting to know Jerry
  Visitors skim first and dig in only where they care.
  The page shows a little, and discloses the rest on request.

  Scenario: A founder skims the selected work
    Given I open the portfolio
    When I open the project "Scenaryo"
    Then I see a sheet titled "Scenaryo"
    And the sheet links to "scenaryo.app"
    When I close the sheet
    Then no sheet is open

  Scenario: A recruiter checks the career path
    Given I open the portfolio
    When I open the path stop "Benify"
    Then I read "Beat the previous regional campaigns by 50%."

  Scenario: A visitor finds the earlier projects
    Given I open the portfolio
    When I expand "Earlier work"
    Then I see a link to "SceneXtras"

  Scenario: A visitor gets in touch
    Given I open the portfolio
    When I copy the email address
    Then the button says "Copied"
    And a toast confirms "Email copied"

  Scenario: A visitor who prefers less motion
    Given I prefer reduced motion
    And I open the portfolio
    Then smooth scrolling is off
    And the career path is not pinned
