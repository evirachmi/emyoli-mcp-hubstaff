# Security policy

## Supported versions

Security fixes are applied to the latest published minor release on `main`.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for undisclosed security problems.

Instead, email the maintainer (see GitHub profile / repository contact) with:

- A short description of the issue and its impact
- Steps to reproduce (if safe to share)
- Any suggested fix or patch (optional)

We aim to acknowledge reports within a few business days.

## Scope notes

This repository ships an MCP server that proxies reads to the Hubstaff API using credentials provided via environment variables. Treat tokens like passwords:

- Never commit `.env` files
- Prefer OS-level secret storage or your MCP host's secret manager when available

Refer to [Hubstaff authentication documentation](https://developer.hubstaff.com/authentication) for token lifecycle guidance.
