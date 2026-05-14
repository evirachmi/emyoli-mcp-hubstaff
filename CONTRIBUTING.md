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

## Docker image

After editing the Dockerfile or dependency graph, verify images still build:

```bash
docker compose build
```

For the detached HTTP transport:

```bash
docker compose up -d mcp-hubstaff-http
curl -sf http://localhost:3333/health
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

Version bumps follow semantic versioning. Maintainers update `package.json` so its `version` field matches the Git tag (without the leading `v`).

1. Bump `version` in `package.json` and commit on `main` (and update `package-lock.json` if you use `npm version patch|minor|major`, which does both).
2. Create a Git tag that matches the release, e.g. for `0.1.0`:

   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin main
   git push origin v0.1.0
   ```

3. Pushing the tag runs the **Release** workflow: it lints, tests, builds, builds the Docker image, and opens a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) for that tag.

Publish to npm when applicable (`npm publish`) after the release is tagged.
