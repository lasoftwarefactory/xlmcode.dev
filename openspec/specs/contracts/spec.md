# Contracts Specification

## Purpose

Deploy audited OpenZeppelin Soroban contracts, or connect to existing live
protocols, on Stellar testnet — and wire them into the generated app.

## Requirements

### Requirement: Manifest-driven catalog
The system SHALL build the contract catalog from JSON manifests in
`contracts/manifests/` and inject it into the LLM system prompt.

#### Scenario: Adding a contract type
- **WHEN** a manifest JSON is added
- **THEN** it appears in the catalog and the agent can propose it — no prompt edit

### Requirement: Ephemeral deploy
The system SHALL deploy a deployable contract from committed WASM using a fresh,
Friendbot-funded keypair, and set the user's connected wallet as owner.

#### Scenario: Deploy a fungible token
- **WHEN** a deploy is confirmed for `oz-fungible-token`
- **THEN** a keypair is funded, WASM uploaded and the constructor invoked
- **AND** the resulting contract id is recorded for the project and wired into
  `/contracts.ts` as `CONTRACTS["oz-fungible-token"]`
- **AND** the user's Freighter wallet owns it (owner-gated writes succeed)

### Requirement: Connect existing protocols
The system SHALL allow connecting a live protocol by contract id without
deploying. Soroswap is connectable; the rest are marked "soon".

#### Scenario: Connect Soroswap
- **WHEN** the user connects Soroswap from the Existing tab
- **THEN** the Soroswap router is recorded for the project and wired into
  `/contracts.ts` — no deploy occurs

### Requirement: Recorded per project
The system SHALL persist each deployed/connected contract per project and expose
it in the Contracts tab.
