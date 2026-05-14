# Contributing to Sessionux Agent

## Code of Conduct

Follow the repository `CODE_OF_CONDUCT.md`.

## Pull Requests

1. Create a feature branch from `develop`.
2. Use Conventional Commits.
3. Add or update tests for behavior changes.
4. Run `npm run check:all`.
5. Run `npm run test:cov` when changing executable code.
6. Submit a pull request to `develop`, except hotfixes targeting `main`.

## Branch Strategy

- `main` is the protected, releasable branch.
- `develop` is the integration branch for the next release.
- Feature branches should use a scoped prefix such as `agent/`, `docs/`, `security/`, or `release/`.
- Release candidates use `release/vX.Y.Z` branches.
- Stable releases use signed `vX.Y.Z` tags from `main`.

## Versioning

Sessionux Agent uses Semantic Versioning.

- `MAJOR` changes are reserved for incompatible protocol, storage, packaging, IPC, or public API changes.
- `MINOR` changes add backward-compatible features.
- `PATCH` changes fix bugs, security issues, documentation, or internal implementation details without changing compatibility.

Pre-release tags use the `vX.Y.Z-rc.N` format.

## Issue Labels

The baseline labels are defined in `.github/labels.yml`:

- `bug`
- `security`
- `performance`
- `agent`
- `mobile`
- `good first issue`
- `rfc`

## Commit Messages

Use Conventional Commits:

```text
<type>(optional-scope): <summary>
```

Accepted types:

- `feat`
- `fix`
- `test`
- `docs`
- `chore`
- `security`

Examples:

```text
feat(agent): add signed unlock endpoint
security(protocol): prevent nonce replay
docs: document Avahi troubleshooting
```
