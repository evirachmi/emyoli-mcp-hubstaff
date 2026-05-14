# mcp-hubstaff

[![CI](https://github.com/evirachmi/emyoli-mcp-hubstaff/actions/workflows/ci.yml/badge.svg)](https://github.com/evirachmi/emyoli-mcp-hubstaff/actions/workflows/ci.yml)

**[Emyoli Technologies](https://emyoli.com)** — We’re a privately held software company with a distributed team, serving as accountable partners for organizations of many sizes. We emphasize responsiveness, transparency, and ethical delivery. Details on **[About Emyoli](https://emyoli.com/aboutus/)**.

---

A small [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that exposes **read** and **selected write** access to the [Hubstaff API v2](https://developer.hubstaff.com/docs/hubstaff_v2). Use it from Cursor, Claude Desktop, or any MCP-capable client to query organizations, projects, members, activities, and related reporting data, or to create manual time entries and manage projects/tasks where your token allows.

This project is **not** affiliated with Hubstaff. Trademarks belong to their respective owners.

## Features

- **Stdio transport** — standard MCP integration via subprocess stdin/stdout.
- **Personal access tokens** — intended workflow for automation (`HUBSTAFF_PERSONAL_ACCESS_TOKEN`).
- **OAuth refresh tokens** — optional support when you already exchange codes outside this binary.
- **Automatic access-token refresh** — refresh tokens are rotated when Hubstaff returns new ones.
- **Guardrailed escape hatch** — `hubstaff_api_get` only allows `organizations/*` and `users/*` prefixes (read-only).
- **Explicit write tools** — create/delete time entries, create/update projects, create tasks; destructive actions are labeled in tool descriptions. Writes require Hubstaff token scopes that permit those endpoints (see Hubstaff PAT / OAuth docs).
- **Docker** — **stdio** MCP (`compose --profile stdio run`) for Cursor/Claude, or **detached HTTP MCP** (`compose up -d`) on port **3333** with `/health` + `/mcp` for Inspector / HTTP clients; `.env` is **never** copied into the image (Compose injects env at runtime).

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
| `MCP_TRANSPORT` | No | `stdio` (default) or `http` (Streamable HTTP server) |
| `MCP_HTTP_HOST` | With `http` | Bind address (default `0.0.0.0` in Docker HTTP service) |
| `MCP_HTTP_PORT` | With `http` | Listen port inside the container (**pinned to 3333** in Compose HTTP service) |
| `MCP_HTTP_PUBLISH_PORT` | Docker HTTP only | Host port mapped to container **3333** (default **3333**) |
| `MCP_HTTP_JSON_RESPONSE` | No | Default **on** (`1`): MCP POST replies use **JSON** (recommended for Cursor — avoids “works once” SSE POST issues). Set `0`, `false`, or `sse` for legacy SSE POST responses + optional event-store stream. |

Do **not** combine `HUBSTAFF_PERSONAL_ACCESS_TOKEN` with `HUBSTAFF_CLIENT_ID` / `HUBSTAFF_CLIENT_SECRET`.

### 3. Install and build

```bash
git clone https://github.com/evirachmi/emyoli-mcp-hubstaff.git
cd emyoli-mcp-hubstaff
npm install
npm run build
```

Prefer Docker instead of local Node? Jump to [Docker](#docker).

### 4. Smoke test (calls Hubstaff)

```bash
export HUBSTAFF_PERSONAL_ACCESS_TOKEN="your_token_here"
node dist/index.js --health
```

You should see `mcp-hubstaff: health check OK` on stderr when `/users/me` succeeds.

## Docker

### Important: stdio vs HTTP

The classic MCP integration speaks **JSON-RPC over stdin/stdout**. That mode **does not listen on a TCP port**, and **`docker compose up -d` cannot attach a client to stdin**, so detached containers are a poor fit for **stdio MCP**.

This repo supports two Compose workflows:

| Goal | Command |
| --- | --- |
| **Detached server + port for testing / HTTP MCP clients** | `docker compose up -d mcp-hubstaff-http` |
| **Stdio MCP (Cursor / Claude spawning Docker)** | `docker compose --profile stdio run --rm -i -T mcp-hubstaff-stdio` |

HTTP mode exposes:

| Endpoint | Purpose |
| --- | --- |
| `http://localhost:${MCP_HTTP_PUBLISH_PORT:-3333}/mcp` | MCP Streamable HTTP |
| `http://localhost:${MCP_HTTP_PUBLISH_PORT:-3333}/health` | Lightweight readiness (does not call Hubstaff) |

Deep credential/API verification still uses `node dist/index.js --health` (calls Hubstaff `/users/me`).

### Secrets and `.env` (do **not** bake into the image)

**Never `COPY .env` into the Dockerfile.** Keep secrets on the host or in your orchestrator’s secret store.

Docker Compose loads the project `.env` file automatically for `${VAR}` substitution on **your machine** and passes the resulting values into the container via `environment:` — nothing is copied into image layers.

**Security:** HTTP MCP **does not implement authentication**. This Compose file publishes the port on **localhost only** (`127.0.0.1`) by default. Use your own proxy and credentials before exposing it broadly.

### Typical commands

```bash
docker compose build

# Hubstaff token check (one-off container)
npm run docker:health

# Detached HTTP MCP + published port (default host port 3333)
docker compose up -d mcp-hubstaff-http
curl -sf http://localhost:3333/health | jq .

# Stop
docker compose down
```

Helper scripts:

| Script | What it runs |
| --- | --- |
| `npm run docker:build` | `docker compose build` |
| `npm run docker:up` | `docker compose up -d mcp-hubstaff-http` |
| `npm run docker:down` | `docker compose down` |
| `npm run docker:health` | Hubstaff health check in a throwaway container |
| `npm run docker:run` | Stdio MCP via `mcp-hubstaff-stdio` profile |

**Why `-i -T` for stdio?** MCP speaks JSON-RPC over stdio. `docker compose run --rm -i -T` keeps stdin open while disabling a pseudo-TTY, matching most MCP hosts.

### Environment variables (HTTP)

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_TRANSPORT` | `stdio` for bare Node | Set to `http` to listen with Express |
| `MCP_HTTP_HOST` | `0.0.0.0` | Bind address inside the container |
| `MCP_HTTP_PORT` | `3333` | Port inside the container (Compose pins this to **3333**) |
| `MCP_HTTP_PUBLISH_PORT` | `3333` | Host port mapped by Compose |

## MCP client configuration

Use this section **after** the server works locally (`npm run build`, `node dist/index.js --health`, or Docker health/up). Paths below assume the repo lives at `/absolute/path/to/emyoli-mcp-hubstaff`.

### 1. Pick a transport

| Transport | When to use | You expose |
| --- | --- | --- |
| **stdio** | Cursor / Claude Desktop run the server as a **child process** on your machine | No TCP port; MCP over stdin/stdout |
| **Streamable HTTP** | Detached Docker (`docker compose up -d mcp-hubstaff-http`), remote VMs, or clients that only speak HTTP MCP | `http://127.0.0.1:3333/mcp` on your host by default |

Our HTTP endpoint does **not** ship authentication—keep it on localhost or behind your own proxy.

---

### 2. Cursor

Official reference: [Model Context Protocol (MCP) — Cursor Docs](https://cursor.com/docs/context/mcp).

**Where to put config**

| Scope | File |
| --- | --- |
| Whole machine | `~/.cursor/mcp.json` |
| This repo only | `.cursor/mcp.json` under the project root |

Cursor merges both; project entries override global ones if names collide.

**Steps**

1. Run `npm run build` (host Node) **or** `docker compose build` (Docker).
2. Edit `mcp.json` using one of the JSON snippets below (use **absolute** paths on disk).
3. Save the file, then **reload MCP** or **restart Cursor** so it picks up changes.
4. In Cursor: **Output** panel → channel **MCP Logs** if something fails to connect.
5. In chat / Agent, tools appear under **Available Tools**; approve tool runs unless you enable auto-run.

**Stdio — Node (local `dist/index.js`)**

```json
{
  "mcpServers": {
    "hubstaff": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/emyoli-mcp-hubstaff/dist/index.js"],
      "env": {
        "HUBSTAFF_PERSONAL_ACCESS_TOKEN": "${env:HUBSTAFF_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

Put the PAT in your shell environment, or replace the `${env:…}` value with a literal (avoid committing secrets).

Optional: load variables from a file Cursor can see:

```json
{
  "mcpServers": {
    "hubstaff": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/emyoli-mcp-hubstaff/dist/index.js"],
      "envFile": "/absolute/path/to/emyoli-mcp-hubstaff/.env"
    }
  }
}
```

(`envFile` is only for **stdio** servers in Cursor.)

**Stdio — Docker Compose (`mcp-hubstaff-stdio`)**

```json
{
  "mcpServers": {
    "hubstaff": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "compose",
        "-f",
        "/absolute/path/to/emyoli-mcp-hubstaff/docker-compose.yml",
        "--profile",
        "stdio",
        "run",
        "--rm",
        "-i",
        "-T",
        "mcp-hubstaff-stdio"
      ]
    }
  }
}
```

Compose must see Hubstaff variables (repo-root `.env` for substitution, or exports in the environment that launches Cursor).

**Remote — Streamable HTTP (after `docker compose up -d mcp-hubstaff-http`)**

```json
{
  "mcpServers": {
    "hubstaff-http": {
      "url": "http://127.0.0.1:3333/mcp"
    }
  }
}
```

Use your real host/port if you changed `MCP_HTTP_PUBLISH_PORT`. Add `"headers": { … }` only if you put a reverse proxy with auth in front of `/mcp`.

---

### 3. Claude Desktop

Configure MCP servers in Claude Desktop’s JSON config (Anthropic documents this under their MCP / Desktop guides—search “Claude Desktop MCP configuration” in [Anthropic Docs](https://docs.anthropic.com/) if the filename moves between releases).

Common locations:

| OS | Typical path |
| --- | --- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

**Steps**

1. Fully quit Claude Desktop (not just close the window).
2. Edit the config file and add a `mcpServers` entry (same shapes as Cursor: `command` / `args` / `env` for stdio, or `url` for HTTP).
3. Save and reopen Claude Desktop.

**Stdio example (Node)**

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

**HTTP example**

```json
{
  "mcpServers": {
    "hubstaff-http": {
      "url": "http://127.0.0.1:3333/mcp"
    }
  }
}
```

---

### 4. Other apps (agents, bots, automation)

Anything that acts as an **MCP host** can attach the same way:

- **Stdio**: spawn `node …/dist/index.js` (or your Docker command) with Hubstaff env vars set; wire the process stdin/stdout to an MCP client implementation.
- **HTTP**: point an MCP client at `http://<host>:3333/mcp` using **Streamable HTTP** (same transport Cursor lists as “Streamable HTTP”).

Pointers:

- [MCP client implementations](https://modelcontextprotocol.io/clients) — ecosystem list.
- [`@modelcontextprotocol/sdk` client](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — e.g. `StdioClientTransport` / `StreamableHTTPClientTransport` for custom agents or services.
- Workflow tools (n8n, Zapier-style stacks, internal bots): look for an **“MCP”** or **“Model Context Protocol”** connector and supply either the **stdio command** block or the **HTTP MCP URL**, depending on what that product supports.

Always scope Hubstaff tokens and network exposure to the smallest trusted surface (localhost, private network, or authenticated gateway).

---

### 5. MCP Inspector (quick manual test)

```bash
npm run build
npm run inspect
```

Stdio: `inspect` runs `@modelcontextprotocol/inspector` against `./dist/index.js`; set `HUBSTAFF_PERSONAL_ACCESS_TOKEN` in the environment first.

HTTP: with `docker compose up -d mcp-hubstaff-http`, open the Inspector, choose **Streamable HTTP**, and use `http://127.0.0.1:3333/mcp` (labels vary slightly by Inspector version).

Run `docker compose build` once so Docker-based snippets work.

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
| `hubstaff_create_time_entry` | `POST /users/{user_id}/time_entries` (manual hours) |
| `hubstaff_delete_time_entry` | `DELETE /users/{user_id}/time_entries/{time_entry_id}` (not the same id as activity rows) |
| `hubstaff_delete_activity` | `DELETE /organizations/{organization_id}/activities/{activity_id}` (segments from `list_activities`) |
| `hubstaff_create_project` | `POST /organizations/{id}/projects` |
| `hubstaff_update_project` | `PUT /projects/{project_id}` |
| `hubstaff_create_task` | `POST /organizations/{id}/tasks` |

Write tools call Hubstaff directly; confirm your **personal access token** or OAuth app includes the scopes Hubstaff documents for those routes (otherwise the API returns `403`).

Query parameter names for **`hubstaff_list_activities`** / **`hubstaff_list_daily_activities`**: the tools accept `start_time`, `stop_time`, and `user_id` and map them to Hubstaff’s `time_slot[start]` / `time_slot[stop]`, or `date[start]` / `date[stop]`, and `user_ids`, as required by the API. For other tools and `hubstaff_api_get`, use the bracketed names from the official docs when applicable.

## Development scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run TypeScript entry via `tsx` |
| `npm run build` | Emit JavaScript to `dist/` |
| `npm test` | Unit tests (`vitest`) |
| `npm run lint` | ESLint (`typescript-eslint`) |
| `MCP_TRANSPORT=http npm run start` | Local Streamable HTTP server (`/mcp`, `/health`) |

## Limits and operational notes

- Streamable HTTP MCP keeps **sessions in memory**. Restarting the container clears them; clients must run **`initialize` again**. This server accepts **`initialize` even if the client still sends an old `mcp-session-id` header** (for example after `docker compose up --force-recreate`). Before each successful `initialize`, **previous in-memory sessions are closed**, so you do not accumulate stale transports. For typical single-client use (Cursor), **single-session fallback** is enabled by default: if there is exactly one active session, POST requests that **omit `mcp-session-id`** or send a **stale** ID are still routed to that session (the header is rewritten to match). That avoids “No valid session ID provided” when the client drops or caches the wrong header. Set **`MCP_HTTP_STRICT_SESSIONS=1`** to disable this and require a matching session header (better if multiple independent clients share one HTTP endpoint). By default **`MCP_HTTP_JSON_RESPONSE` is on**, so POST `/mcp` returns JSON instead of wrapping the first reply in an SSE stream — that matches Cursor’s Streamable HTTP client and avoids losing the session after the first round-trip.
- Hubstaff enforces **rate limits** (documented around **1000 requests/hour per application** — verify in current Hubstaff docs).
- Some queries can exceed Hubstaff’s **~30 second** processing window; narrow date ranges or filter dimensions when possible.
- Organization IDs are **numeric**. Discover them via `hubstaff_list_organizations`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## License

MIT — see [LICENSE](./LICENSE).
