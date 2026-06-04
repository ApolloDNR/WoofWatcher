# GitHub Publishing Notes

WoofWatcher is published to a private GitHub repository.

## Current State

- Project folder: `projects/woofwatcher`
- Local repository root: `projects/woofwatcher`
- GitHub repository: `ApolloDNR/WoofWatcher`
- Visibility: private.
- Local remote: `origin` -> `https://github.com/ApolloDNR/WoofWatcher.git`
- Current pushed head: `438d83d` (`Merge remote repository initialization`), which preserves GitHub's initial repository commit and the full local WoofWatcher app history through `fdd3574` (`Add Phoenix bile watch`).
- A GitHub Actions workflow is ready at `.github/workflows/verify.yml`.
- The GitHub connector confirmed admin/push permissions. The local `gh` CLI may still need refreshed auth for interactive GitHub CLI commands.

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
