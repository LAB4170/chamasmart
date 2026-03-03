# DECISIONS.md — Architecture Decision Records (ADR)

## [ADR-001] GSD Methodology Adoption
- **Status**: Accepted
- **Context**: The project needs a disciplined approach to stabilize financial logic and maintain architectural consistency.
- **Decision**: Adopt the Get Shit Done (GSD) methodology for planning, execution, and verification.
- **Consequences**: Strict requirements for SPEC.md approval before work and empirical verification of all changes.

## [ADR-002] Joi Schema Normalization (snake_case)
- **Status**: Accepted
- **Context**: Controllers extract `req.body` using `snake_case` (e.g., `chama_id`), while existing Joi schemas often use `camelCase` or are missing fields.
- **Decision**: Normalize all Joi validation schemas to use `snake_case` exactly matching the controller extraction patterns.
- **Consequences**: Avoids validation rejection of valid API requests and ensures consistency across the validation-controller boundary.
