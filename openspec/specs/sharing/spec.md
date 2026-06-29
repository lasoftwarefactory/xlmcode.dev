# Sharing Specification

## Purpose

Let anyone view a project read-only via a public link, and clone it (after sign
in) to get an editable copy. Optionally deliver the link by email.

## Requirements

### Requirement: Public read-only link
The system SHALL let an owner generate a share link (`/p/:token`) that anyone —
including users with no account — can open read-only.

#### Scenario: Anonymous viewer
- **WHEN** an anonymous visitor opens `/p/:token`
- **THEN** they see the app layout: chat history (read-only) on the left, and the
  workspace (preview, code, contracts, console, versions) on the right
- **AND** the composer is locked and editing is disabled

### Requirement: Wallet works on shared pages
The system SHALL run the Freighter bridge on the shared page so wallet connect
works in the preview just like in the app.

#### Scenario: Connect wallet on a shared preview
- **WHEN** a viewer connects Freighter in a `/p/:token` preview
- **THEN** the connection succeeds (the host bridge answers the iframe)

### Requirement: Edit requires cloning
The system SHALL require sign-in + clone before editing a shared project.

#### Scenario: Sign in then clone
- **WHEN** a logged-out viewer clicks the clone CTA ("Sign in to code")
- **THEN** they are prompted to sign in
- **AND** after signing in (OTP or Google) the clone proceeds and opens their new
  editable project — the action gives disabled+spinner feedback

### Requirement: Email a share link
The system SHALL optionally email a share link via Resend.

#### Scenario: Sending by email
- **WHEN** the owner enters a recipient and sends
- **THEN** a share link is created and emailed; if email is not configured the
  link still works and the UI surfaces the failure
