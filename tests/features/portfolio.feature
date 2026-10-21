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
    Then I see a sheet titled "Benify"
    And I read "Beat the previous regional campaigns by 50%."

  Scenario: A founder reads about the pitch to Tim Draper
    Given I open the portfolio
    When I open the path stop "Draper University"
    Then I see a sheet titled "Draper University"
    And I read "Six million characters?"

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

  Scenario: A visitor spins the Berlin desk on request
    Given I prefer reduced motion
    And I open the portfolio
    Then no 3D model has been downloaded
    When I open the path stop "My Berlin desk"
    Then I see a sheet titled "My Berlin desk"
    And the 3D model is ready
    And the path wheel offers "2024 · Draper University" and "Now · Scenaryo"
    When I turn the desk right
    And I close the sheet
    Then no sheet is open
    And no model canvas remains

  Scenario: A visitor flips the Buildspace badge
    Given I prefer reduced motion
    And I open the portfolio
    Then no 3D model has been downloaded
    When I open the path stop "buildspace"
    Then the 3D model is ready
    When I flip the Buildspace badge
    Then the lanyard is visible

  Scenario: A visitor opens Scenaryo research on a phone
    Given the viewport is 390 pixels wide
    And I prefer reduced motion
    And I open the portfolio
    When I open the project "Scenaryo"
    And I scroll the sheet to its end
    Then its research CTA is fully visible
    When I follow its research CTA
    Then the research URL opens

  Scenario: A client explores Leapfrog AI
    Given I prefer reduced motion
    And I open the portfolio
    When I open the project "Leapfrog AI"
    Then I see a sheet titled "Leapfrog AI"
    And the sheet links to "lfg-ai.com"

  Scenario: A recruiter reads the recommendations
    Given I prefer reduced motion
    And I open the portfolio
    Then six recommendations share the same composition
    And Dan Goldin has an honorary mention
    And the canonical URL is "https://jerrydoughan.com/"
