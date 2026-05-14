# Contributing

Thank you for improving `mcp-hubstaff`.

## Principles

- Prefer small, focused pull requests with a clear motivation.
- Match existing formatting and TypeScript style (`npm run lint`).
- Add or update tests when behavior changes (`npm test`).
- Document user-visible behavior in `README.md`.

## Local setup

```bash
npm install
npm run build
npm test
npm run lint
```

## Hubstaff credentials

Integration checks against the live Hubstaff API require a valid personal access token.

1. Create a token per [Hubstaff personal access tokens](https://developer.hubstaff.com/personal_access_tokens).
2. Export `HUBSTAFF_PERSONAL_ACCESS_TOKEN` in your shell **or** load it from a local `.env` file that stays untracked.

```bash
export HUBSTAFF_PERSONAL_ACCESS_TOKEN="your_refresh_token_here"
npm run build
node dist/index.js --health
```

## Releases

Version bumps follow semantic versioning. Maintainers update `package.json`, tag the release, and publish to npm when applicable.
