# Agent Recipe Intake v1

`contracts/agent.recipe.v1.schema.json` is the quarantine contract for external agent examples. A public repository or MIT license does not make a recipe safe to run.

## Intake flow

1. Save source URL, license, pinned revision and verification date.
2. Assign an Eclipse owner and a concrete purpose.
3. Keep network denied until an allowlist is reviewed.
4. Record every tool source and SHA-256 hash of its reviewed description.
5. Use synthetic fixtures. Sensitive data is rejected by default.
6. Set a hard cost limit and mandatory human evaluation.
7. Move from `quarantine` to `approved` only after license, dependency, prompt, permission and output review.

Tool descriptions are untrusted input. A changed description hash returns the recipe to quarantine and blocks execution until it is reviewed again. This catches tool poisoning and later rug-pull changes without granting the recipe broad runtime access.

The initial source catalog is `500-AI-Agents-Projects`, but no linked repository inherits trust or approval from that catalog.