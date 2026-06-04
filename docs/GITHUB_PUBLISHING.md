# GitHub Publishing Notes

WoofWatcher is published to a private GitHub repository.

## Current State

- Project folder: `projects/woofwatcher`
- Local repository root: `projects/woofwatcher`
- GitHub repository: `ApolloDNR/WoofWatcher`
- Visibility: private.
- Local remote: `origin` -> `https://github.com/ApolloDNR/WoofWatcher.git`
- Publishing merge milestone: `438d83d` (`Merge remote repository initialization`), which preserves GitHub's initial repository commit and the full local WoofWatcher app history through `fdd3574` (`Add Phoenix bile watch`).
- Latest verified implementation commit: `1b6f9a8b28721fa7b8a6d6f593edde921a98bff6` (`Stabilize care schedule tests across timezones`).
- Latest verified GitHub Actions run at doc time: `WoofWatcher Verify` run `26980717210`, completed successfully on 2026-06-04.
- To confirm the latest pushed head, run `git ls-remote origin refs/heads/main` from this folder.
- A GitHub Actions workflow is active at `.github/workflows/verify.yml`.
- The GitHub connector confirmed admin/push permissions. Local `gh` run checks work when GitHub API network access is allowed in the session.

## Repository Shape

Keep the repository private until caregiver privacy, account sync, and medical-record handling are decided.

## Future GitHub CLI Auth

If Apollo wants to use the local GitHub CLI instead of the connector or normal git remote, refresh CLI auth:

```powershell
gh auth login -h github.com
gh run list --repo ApolloDNR/WoofWatcher
```

## Do Not Commit

- `.env`
- `.env.local`
- any `OPENAI_API_KEY`
- exported Phoenix backup JSON containing private care records
- exported Phoenix transfer JSON containing private care records and handoff context
