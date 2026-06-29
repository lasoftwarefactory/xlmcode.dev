# Projects Specification

## Purpose

A project is a 1:1 conversation that owns a generated app. The `FileTree`
(path → contents) is the single source of truth, persisted to Supabase and
synced to an in-memory store on the client.

## Requirements

### Requirement: Create a project from a prompt
The system SHALL create the project server-side before streaming the first
prompt, so the chat always has a project id.

#### Scenario: First prompt
- **WHEN** a logged-in user submits the first prompt
- **THEN** a project row is created (with the scaffold as `current_files`)
- **AND** only then is the prompt streamed to the model
- **AND** no "project not yet saved" race occurs

### Requirement: Authoritative persistence
The system SHALL treat `projects.current_files` as the working tree and
`project_versions` as history; reload restores from `current_files`.

#### Scenario: Reload restores state
- **WHEN** a user reopens or hard-reloads a project
- **THEN** the editor shows `current_files` (not an empty tree)
- **AND** the version history is available

### Requirement: Prompt rate limiting
The system SHALL enforce a per-user daily / first-day prompt quota atomically;
admins are unlimited.

#### Scenario: Quota exhausted
- **WHEN** a user exceeds their quota
- **THEN** the chat request is rejected with 429 and no generation runs

### Requirement: Destructive delete guard
The system SHALL require explicit confirmation to delete a project.

#### Scenario: Confirming a delete
- **WHEN** the user opens the delete dialog
- **THEN** delete is enabled only after they type the project name (trimmed,
  case- and accent-insensitive) AND the word "delete"
- **AND** deleting removes the project and its versions, messages and contracts

### Requirement: Sidebar shows only owned projects
The system SHALL list only the user's own editable projects in the sidebar
(never templates or read-only views).
