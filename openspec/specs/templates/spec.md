# Templates Specification

## Purpose

Curated, ready-to-use starter projects owned by a system account. Users preview a
template read-only and clone it to get their own editable copy.

## Requirements

### Requirement: System-owned, publicly readable
The system SHALL store templates as projects flagged `is_template`, owned by the
system account, readable by anyone (no account required).

#### Scenario: Listing templates
- **WHEN** the templates list is requested (logged in or out)
- **THEN** published system templates are returned, ordered by `sort_order`

### Requirement: Open as a shared preview
The system SHALL open a template via its read-only shared preview at `/p/:token`.

#### Scenario: Clicking a template badge
- **WHEN** a user clicks a template badge or card
- **THEN** they navigate to `/p/:token` showing code, contracts and live preview
  read-only

### Requirement: Clone into the caller's account
The system SHALL clone a template into the caller's account with a name that is
unique per owner.

#### Scenario: Cloning
- **WHEN** a logged-in user clones a template
- **THEN** a new owned project is created copying files, versions, messages and
  the (shared) contracts
- **AND** the name is deduplicated as "<name> (Clone)", then "(Clone 1)", "(Clone 2)"…

### Requirement: Static badges
The system SHALL render the landing/app template badges from a static list (no
fetch) so they never flicker, each linking to `/p/:token`.
