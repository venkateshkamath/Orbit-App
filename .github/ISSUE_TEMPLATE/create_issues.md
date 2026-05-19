# Event Creation User Stories - Issues

## Issue 1: Event Name Field
- **Assignee**: Sairaj-creator
- **Description**: As a user creating an event, I want to give my event a name so that others know what it's about at a glance.
- **Acceptance Criteria**:
  - Text input field, mandatory
  - Character limit: 60 characters
  - Placeholder: "What's the plan?"

## Issue 2: Event Category Selection
- **Assignees**: Sathwik, Vaishanvi
- **Description**: As a user, I want to pick a category for my event so it's easier to discover for the right people.
- **Acceptance Criteria**:
  - Single select from a predefined list (to be finalized after Vaishanvi's input)
  - Mandatory field

## Issue 3: Event Location Picker
- **Assignee**: Sairaj-creator
- **Description**: As a user, I want to set a location for my event so attendees know where to show up.
- **Acceptance Criteria**:
  - Location picker with map support (Google Maps integration)
  - User can search or drop a pin
  - Mandatory field

## Issue 4: Event Date & Time Selection
- **Assignee**: Sathwik
- **Description**: As a user, I want to set a start time and optionally add a duration for my event so people know when to be there and (optionally) how long it runs.
- **Acceptance Criteria**:
  - Date picker — mandatory
  - Start time — mandatory
  - Duration — optional
  - No past dates allowed

## Issue 5: Event Min & Max People
- **Assignee**: Sairaj-creator
- **Description**: As a user, I want to set a headcount range so the event doesn't feel too empty or too crowded.
- **Acceptance Criteria**:
  - Two numeric inputs: Minimum and Maximum
  - Both mandatory
  - Max must be greater than Min
  - Min defaults to 2

## Issue 6: Anyone Can Join Toggle
- **Assignee**: Sathwik
- **Description**: As a user, I want to control who can join my event so I can decide how open or curated it is.
- **Acceptance Criteria**:
  - When toggle is ON (Anyone Can Join):
    - Event is publicly visible to nearby users
    - Anyone can join directly without approval
  - When toggle is OFF (default):
    - Interested users can request to join
    - They are added to a waitlist
    - Event admin reviews the waitlist and approves or rejects each request
    - Requester gets notified on approval or rejection
