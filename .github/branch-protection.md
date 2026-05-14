# Branch Protection

The `main` branch is protected in GitHub.

Required status checks for pull requests:

- `CI / check`

The required CI job runs on every pull request so checks do not stay pending when a PR changes documentation or repository metadata only.

The job executes:

- `npm run lint`
- `npm run typecheck`
- `npm run test:cov`
- `npm run build`
