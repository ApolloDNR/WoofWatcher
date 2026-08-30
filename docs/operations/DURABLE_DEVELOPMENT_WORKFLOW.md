# Durable Development Workflow

## Binding checkpoint sequence

Every implementation slice follows this exact sequence:

```text
fetch -> branch/worktree -> failing test -> implementation -> focused gate -> full gate -> independent review -> commit -> push -> read remote SHA -> CI on that SHA -> update STATUS.md
```

A milestone is not complete until its reviewed commit is pushed and its remote SHA has been read and verified. A local commit, local test result, or local build is never a completion checkpoint.

## Checkpoint rules

- Every pause receives a pushed WIP checkpoint.
- Agents use separate, non-overlapping worktrees.
- No force-push. Preserve shared history and recover with ordinary commits.
- Independent review occurs before the remote mutation for a release checkpoint.
- Record the pushed commit SHA and the CI result on that SHA in `docs/release/STATUS.md`; this ledger is the current release truth.

## Recovery rule

If a workspace is pruned, recover from the last verified remote SHA by creating a fresh clone or worktree from that SHA. Do not reconstruct state from an unpushed local workspace, editor history, or an assumed branch tip.

## Proof boundary

Browser and native proof are separate. Browser verification never establishes a native verdict; native physical-device, accessibility, safe-area, touch, permission, haptic, sharing, Back/deep-link, and large-text evidence must be recorded separately in the status ledger.
