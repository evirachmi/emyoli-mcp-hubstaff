# mcp-hubstaff

[![CI](https://github.com/evirachmi/emyoli-mcp-hubstaff/actions/workflows/ci.yml/badge.svg)](https://github.com/evirachmi/emyoli-mcp-hubstaff/actions/workflows/ci.yml)

A small [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that exposes **read-only** access to the [Hubstaff API v2](https://developer.hubstaff.com/docs/hubstaff_v2). Use it from Cursor, Claude Desktop, or any MCP-capable client to query organizations, projects, members, activities, and related reporting data.

This project is **not** affiliated with Hubstaff. Trademarks belong to their respective owners.

## Features

- **Stdio transport** — standard MCP integration via subprocess stdin/stdout.
- **Personal access tokens** — intended workflow for automation (`HUBSTAFF_PERSONAL_ACCESS_TOKEN`).
- **OAuth refresh tokens** — optional support when you already exchange codes outside this binary.
- **Automatic access-token refresh** — refresh tokens are rotated when Hubstaff returns new ones.
- **Guardrailed escape hatch** — `hubstaff_api_get` only allows `organizations/*` and `users/*` prefixes.
- **Docker** — run via `docker compose` without installing Node on the host (stdio-friendly flags documented below).

## Requirements

- **Local / Node:** Node.js **20** or newer, **or**
- **Docker:** Docker Engine and Docker Compose v2
- A Hubstaff account with API access and appropriate organization roles (many endpoints require manager/owner visibility).

## Quick start

### 1. Create credentials

The easiest path for an MCP server is a Hubstaff **personal access token** (PAT). Hubstaff PATs behave like **long-lived refresh tokens**; this server exchanges them for short-lived access tokens automatically.

Official docs:

- [Personal access tokens](https://developer.hubstaff.com/personal_access_tokens)
- [Authentication overview](https://developer.hubstaff.com/authentication)

### 2. Configure environment

Copy `.env.example` to `.env` (keep it untracked) **or** export variables in your MCP host configuration.

| Variable | Required | Description |
| --- | --- | --- |
| `HUBSTAFF_PERSONAL_ACCESS_TOKEN` | Usually yes | PAT refresh token from Hubstaff |
| `HUBSTAFF_REFRESH_TOKEN` | Alternative | OAuth refresh token |
| `HUBSTAFF_CLIENT_ID` | With OAuth refresh | OAuth application client id |
| `HUBSTAFF_CLIENT_SECRET` | With OAuth refresh | OAuth application client secret |
| `HUBSTAFF_API_BASE_URL` | No | Override API base (default `https://api.hubstaff.com/v2`) |

Do **not** combine `HUBSTAFF_PERSONAL_ACCESS_TOKEN` with `HUBSTAFF_CLIENT_ID` / `HUBSTAFF_CLIENT_SECRET`.

### 3. Install and build

```bash
git clone https://github.com/evirachmi/emyoli-mcp-hubstaff.git
cd emyoli-mcp-hubstaff
npm install
npm run build
```

Prefer Docker instead of local Node? Jump to [Docker](#docker-recommended-if-you-do-not-want-node-on-the-host).

### 4. Smoke test (calls Hubstaff)

```bash
export HUBSTAFF_PERSONAL_ACCESS_TOKEN="your_token_here"
node dist/index.js --health
```

You should see `mcp-hubstaff: health check OK` on stderr when `/users/me` succeeds.

## Docker (recommended if you do not want Node on the host)

From the repository root (where `docker-compose.yml` lives), create a `.env` file—Compose reads it automatically for variable substitution (same variables as [.env.example](./.env.example)).

Build and sanity-check against Hubstaff:

```bash
docker compose build
docker compose run --rm -i -T mcp-hubstaff node dist/index.js --health
```

Helper scripts:

| Script | What it runs |
| --- | --- |
| `npm run docker:build` | `docker compose build` |
| `npm run docker:health` | Health check inside a one-off container |
| `npm run docker:run` | Starts the MCP server on stdio (used by MCP clients; see below) |

**Why `-i -T`?** MCP speaks JSON-RPC over stdio. `docker compose run --rm -i -T` keeps stdin open for the host process while disabling a pseudo-TTY, which matches how most MCP hosts spawn subprocesses.

## MCP client configuration

Paths below assume you cloned to `/absolute/path/to/emyoli-mcp-hubstaff`.

### Cursor

Add an MCP server entry (Cursor Settings → MCP). Pick **either** Node **or** Docker.

**Node (local build)**

```json
{
  "mcpServers": {
    "hubstaff": {
      "command": "node",
      "args": ["/absolute/path/to/emyoli-mcp-hubstaff/dist/index.js"],
      "env": {
        "HUBSTAFF_PERSONAL_ACCESS_TOKEN": "your_token_here"
      }
    }
  }
}
```

**Docker Compose** (token in repo-root `.env`, or exported in your shell before launching Cursor)

```json
{
  "mcpServers": {
    "hubstaff": {
      "command": "docker",
      "args": [
        "compose",
        "-f",
        "/absolute/path/to/emyoli-mcp-hubstaff/docker-compose.yml",
        "run",
        "--rm",
        "-i",
        "-T",
        "mcp-hubstaff"
      ]
    }
  }
}
```

Run `docker compose build` once from that directory so the image exists.

### Claude Desktop

Edit `claude_desktop_config.json` per Anthropic’s MCP documentation. Use the same **Node** or **Docker** patterns as above (`command` / `args` / optional `env`).

### MCP Inspector (interactive debugging)

```bash
npm run build
npm run inspect
```

(`inspect` runs `npx @modelcontextprotocol/inspector` against `./dist/index.js`; use an absolute path if you prefer calling `npx` directly.)

Load `HUBSTAFF_PERSONAL_ACCESS_TOKEN` into the inspector environment before connecting.

## Tools

| Tool | Summary |
| --- | --- |
| `hubstaff_whoami` | `GET /users/me` |
| `hubstaff_list_organizations` | `GET /organizations` |
| `hubstaff_list_projects` | `GET /organizations/{id}/projects` |
| `hubstaff_list_members` | `GET /organizations/{id}/members` |
| `hubstaff_list_teams` | `GET /organizations/{id}/teams` |
| `hubstaff_list_tasks` | `GET /organizations/{id}/tasks` |
| `hubstaff_list_job_sites` | `GET /organizations/{id}/job_sites` |
| `hubstaff_list_activities` | `GET /organizations/{id}/activities` |
| `hubstaff_list_daily_activities` | `GET /organizations/{id}/activities/daily` |
| `hubstaff_list_timesheets` | `GET /organizations/{id}/timesheets` |
| `hubstaff_list_screenshots` | `GET /organizations/{id}/screenshots` |
| `hubstaff_get_user` | `GET /users/{user_id}` |
| `hubstaff_api_get` | Authenticated `GET` under `/v2` with path allowlist |

Query parameter names follow Hubstaff’s reference (for example `page_start_id`, `start_time`, `stop_time`). When in doubt, consult the official API docs for the endpoint you are calling.

## Development scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run TypeScript entry via `tsx` |
| `npm run build` | Emit JavaScript to `dist/` |
| `npm test` | Unit tests (`vitest`) |
| `npm run lint` | ESLint (`typescript-eslint`) |

## Limits and operational notes

- Hubstaff enforces **rate limits** (documented around **1000 requests/hour per application** — verify in current Hubstaff docs).
- Some queries can exceed Hubstaff’s **~30 second** processing window; narrow date ranges or filter dimensions when possible.
- Organization IDs are **numeric**. Discover them via `hubstaff_list_organizations`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## License

MIT — see [LICENSE](./LICENSE).
