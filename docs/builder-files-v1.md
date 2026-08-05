# Eclipse AI Builder files contract v1

`builder.files.v1` is the review boundary between an approved product plan and any future local
workspace. It turns an approved `builder.project.v1` artifact into a small deterministic React/Vite
scaffold that a person can inspect and download as JSON.

The renderer does not write files, install dependencies, execute generated code, access the network,
connect GitHub or deploy an application. All policy flags in the artifact are fixed to `false`.

## Input gate

The renderer accepts only a `builder.project.v1` document whose status is `approved` and which has a
complete human approval record. A draft or `ready_for_review` plan fails closed.

## Output

The artifact contains exactly eight allowlisted paths:

- `index.html`
- `package.json`
- `README.md`
- `src/App.tsx`
- `src/main.tsx`
- `src/styles.css`
- `tsconfig.json`
- `vite.config.ts`

Paths cannot be absolute and cannot contain traversal segments. The complete artifact is limited to
128 KB. User-provided strings are emitted as escaped JSON literals in TypeScript and stripped of HTML
brackets in Markdown. React renders the values as text; no raw HTML API is used.

Dependencies use exact versions so review results are reproducible. The artifact is still
`unreviewed`: exact pins do not replace an advisory, license or supply-chain review.

## Consumer requirements

A downstream consumer must:

1. Validate the JSON against [`builder.files.v1.schema.json`](../contracts/builder.files.v1.schema.json).
2. Verify tenant ownership and the referenced source project version.
3. Reset review and approval state at the trust boundary.
4. Reject unknown fields, unexpected paths, symlinks, traversal and existing destination files.
5. Show a complete diff and require explicit approval before writing anything.
6. Keep dependency installation, code execution, GitHub access and deployment as separate permissions.

## Next safe stage

A workspace materializer may write these files only into an empty directory explicitly selected by
the user. It must not follow symlinks, overwrite existing files, invoke a shell, install packages or
make network requests. Tests and preview should later run in a disposable sandbox with resource and
network limits.

### Local materializer

Review the plan without changing the filesystem:

```bash
npm run builder:materialize -- --artifact ./builder-files.json --out ./new-app
```

After reviewing all eight paths, repeat with the explicit write gate:

```bash
npm run builder:materialize -- --artifact ./builder-files.json --out ./new-app --write
```

The destination must be a new or empty real directory beneath an existing parent. Filesystem roots,
non-empty directories, symbolic-link paths, substituted files, size mismatches and policy escalation
are rejected before writing. The package manifest must match the renderer v1 scripts, package allowlist
and exact dependency versions, so lifecycle-script injection fails before any filesystem mutation.
Every file uses create-only semantics; rollback removes only paths made by the current run. The command still does not install dependencies, run the scaffold, access the
network, connect GitHub or deploy.
