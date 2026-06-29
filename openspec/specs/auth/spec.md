# Auth Specification

## Purpose

Passwordless authentication (email OTP + Google OAuth) with server-managed
sessions. The browser never holds database credentials — the Express backend
validates the session per request and Postgres RLS scopes data via `auth.uid()`.

## Requirements

### Requirement: Email OTP sign-in
The system SHALL let a user sign in with a one-time code sent to their email; no
password is stored.

#### Scenario: Code requested and verified
- **WHEN** a user submits their email
- **THEN** Supabase emails a one-time code
- **WHEN** the user submits a valid code
- **THEN** a session is established and a profile row exists for the user

### Requirement: Google OAuth sign-in
The system SHALL support Google OAuth and return the user to the page they
started from.

#### Scenario: Returns to origin, not a fixed page
- **WHEN** a user starts Google sign-in from a page that passes a relative `next`
- **THEN** after the OAuth round-trip the user is redirected back to `next`
- **AND** `next` is rejected unless it is a relative path (no open redirect)

### Requirement: Profile provisioning
The system SHALL create a profile on first sign-in with the default plan, and the
founder email SHALL be granted admin automatically.

#### Scenario: First sign-in
- **WHEN** a new auth user is created
- **THEN** a `profiles` row is inserted with plan `hacker`
- **AND** if the email is the founder email, `is_admin` is set true

### Requirement: Backend-only data access
The system SHALL keep all table access behind the Express backend; the frontend
calls the API and never queries Supabase directly.

#### Scenario: Request without a valid session
- **WHEN** an API request to a protected route has no valid session
- **THEN** the backend responds 401 and no data is returned
