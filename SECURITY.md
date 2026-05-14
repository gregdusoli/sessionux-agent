# Security Policy

## Supported Versions

Sessionux Agent is currently in development. Security fixes target the protected `main` branch and the active `develop` branch until the first stable release.

## Reporting a Vulnerability

Do not report security vulnerabilities through public GitHub issues.

Report vulnerabilities privately to the maintainers. Until a dedicated address is published, open a private maintainer contact channel and include:

- affected version or commit
- reproduction steps
- impact assessment
- relevant logs with secrets redacted

## Security Scope

Security-sensitive Agent areas include:

- protocol validation
- Ed25519 signature verification
- pairing setup tokens
- nonce and timestamp validation
- local storage permissions
- IPC boundaries
- mDNS advertisement
- `loginctl` or D-Bus unlock execution

## Our Commitment

- We will acknowledge receipt within 48 hours.
- We will coordinate a fix before public disclosure.
- We will credit reporters when desired.
