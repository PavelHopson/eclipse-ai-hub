# Eclipse AI Builder and builder.project.v1

Eclipse AI Builder is a clean-room product workflow inspired by the useful product idea behind
Shipper.now: describe an application in plain language, turn the brief into a visible plan, inspect
the expected interface and decide what should be built next.

The first slice deliberately stops before code execution. It is a planning and review surface, not
a cloud IDE and not an autonomous deploy agent.

## User flow

1. Describe the product, its users, the problem and one primary action.
2. Choose a landing, dashboard or catalog starting point.
3. Create a deterministic blueprint with routes, sections, data entities and mandatory UI states.
4. Compare desktop and mobile preview.
5. Review the build queue and its explicit gates.
6. Confirm requirements, the security boundary and the preview.
7. Export `builder.project.v1.json` for the next reviewed implementation stage.

## What this slice does not do

- no generated code is executed;
- no arbitrary prompt, shell command, package installer or MCP tool is accepted;
- no GitHub account, repository, domain, payment system or production environment is connected;
- no preview content is treated as trusted HTML;
- no app is published and the UI does not claim that it has been built.

React renders preview strings as text. The versioned contract fixes every external capability to
`false`, including code execution, GitHub, deploy and payments. Approval means “the plan has been
reviewed”; it never grants those capabilities.

Every downstream consumer must validate the schema, treat all strings as untrusted data and reset
approval at its own authorization boundary. An imported `approved` value never grants execution rights.

## Input boundary

- brief size: no more than 16 KB;
- name: 3–80 characters;
- audience: 5–160 characters;
- problem: 20–600 characters;
- primary action: 3–80 characters;
- no more than eight requirements, 3–240 characters each;
- control characters and high-confidence credential patterns are rejected.

The browser does not persist the brief automatically. Export is an explicit user action.

## Planned next stages

1. Schema-validating import into Eclipse Chat Builder Room with tenant ownership and versioning.
2. A server-side advisor with fixed roles and bounded one-step requests.
3. The isolated template renderer is implemented as [`builder.files.v1`](builder-files-v1.md): it
   produces reviewable files without writing or running them.
4. Add security, dependency, license, test and responsive QA gates before any materialization.
5. Add a separate publish workflow with diff, rollback and explicit authorization.

Shipper remains a proprietary product reference. Its source code and private implementation are
not used by this repository.
