# Builder Git patch handoff

`builder.patch.v1` turns one reviewed `builder.delivery.v1` checkpoint into a visible, add-only Git
patch. It is a local export boundary: the browser neither connects to GitHub nor writes into a
repository.

## Contract

- every file is revalidated for a relative path, exact UTF-8 byte size and artifact limits;
- duplicate paths, traversal, NUL and bidirectional override controls fail closed;
- the patch is bound to the delivery, current checkpoint, source artifact and selected branch;
- only new regular files with mode `100644` are emitted;
- the UI shows the complete diff before enabling the download action;
- exporting changes only `patchExported`, `patchFingerprint` and `exportedAt` in the delivery
  passport;
- applying the patch, installing dependencies, running code, committing, pushing and deploying
  remain false and require a separate human-controlled workflow.

The schema is [`builder.patch.v1.schema.json`](../contracts/builder.patch.v1.schema.json).

## Reviewed application

After downloading the patch, a reviewer works in an already approved local repository and existing
branch:

```text
git switch <existing-approved-branch>
git apply --check <downloaded.patch>
git apply <downloaded.patch>
git diff --check
```

Those commands are intentionally not executed by the web application. A successful download is not
proof that the branch exists, the patch applies, dependencies are safe or tests pass.
