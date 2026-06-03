# GitHub Publishing Notes

WoofWatcher is ready to publish as a repository, but this local folder is not currently connected to a GitHub remote.

## Current State

- Project folder: `projects/woofwatcher`
- Local repository root: `projects/woofwatcher`
- Current local commit: run `git rev-parse --short HEAD` from this folder.
- `gh auth status` found an invalid token for `ApolloDNR`.
- A GitHub Actions workflow is ready at `.github/workflows/verify.yml`.

## Recommended Repository Shape

Create a new private repository, for example:

```text
ApolloDNR/woofwatcher
```

Keep it private until caregiver privacy, account sync, and medical-record handling are decided.

## Publish Steps After GitHub Auth Is Fixed

```powershell
gh auth login -h github.com
gh repo create ApolloDNR/woofwatcher --private --source . --remote origin --push
```

After push, GitHub Actions should run:

```powershell
npm run check
npm test
```

## Do Not Commit

- `.env`
- `.env.local`
- any `OPENAI_API_KEY`
- exported Phoenix backup JSON containing private care records
