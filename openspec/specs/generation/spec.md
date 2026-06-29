# Generation Specification

## Purpose

Turn a natural-language prompt into a working multi-file React app plus contract
actions, applied to the project's `FileTree`. The model's output follows a strict
Zod contract so the app can apply it deterministically.

## Requirements

### Requirement: Structured agent output
The system SHALL require the model to return an `AgentResponse`
(`{ message, files: FileOp[], actions?: AgentAction[] }`) validated by the Zod
schema in `shared/schema.ts`; file ops are create / edit / delete.

#### Scenario: Applying a turn
- **WHEN** the model returns file ops
- **THEN** the app applies them to the `FileTree` and records a version
- **AND** a malformed response is tolerated/parsed without crashing the UI

### Requirement: Deploy-first for on-chain features
The system SHALL, for any on-chain feature, propose a `deploy_contract` action
mapped to the right manifest rather than faking it with local state.

#### Scenario: User asks for a token / NFT
- **WHEN** the prompt implies a token, NFT or ownership feature
- **THEN** the agent proposes a deploy action (files empty that turn)
- **WHEN** the user confirms
- **THEN** the contract is deployed and wired into `/contracts.ts`, and the UI is
  built the next turn

### Requirement: Provided dev kit
The system SHALL provide the on-chain dev kit (`/polyfills.ts`, `/stellar.ts`,
`/contracts.ts`) in every project; the agent imports it and never recreates or
stubs it.

#### Scenario: Generated app wiring
- **WHEN** the agent builds an app
- **THEN** it imports helpers from `./stellar` and reads `CONTRACTS[...]` from
  `./contracts`, and `/App.tsx` imports `./polyfills` first

### Requirement: Guardrail
The system SHALL refuse off-scope or abusive prompts before generation.

#### Scenario: Off-scope prompt
- **WHEN** a prompt is outside building a Stellar dApp (or is abusive)
- **THEN** the request is refused with a short message and no generation runs
