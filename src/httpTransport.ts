import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";

import type { Express, Request, Response } from "express";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createHubstaffMcpServer } from "./createHubstaffMcp.js";
import type { HubstaffClient } from "./hubstaff/client.js";

function headerSessionId(req: IncomingMessage): string | undefined {
  const raw = req.headers["mcp-session-id"];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}

/** Express usually parses JSON; keep a fallback when body arrives as a string. */
function normalizeMcpPostBody(body: unknown): unknown {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return body;
    }
  }
  return body;
}

function setIncomingSessionHeader(req: IncomingMessage, sessionId: string): void {
  req.headers["mcp-session-id"] = sessionId;

  const rh = req.rawHeaders;
  const headerName = "mcp-session-id";
  for (let i = 0; i < rh.length; i += 2) {
    const key = rh[i];
    if (typeof key === "string" && key.toLowerCase() === headerName) {
      rh[i + 1] = sessionId;
      return;
    }
  }
  rh.unshift(headerName, sessionId);
}

/**
 * When false (default), a single active Streamable HTTP session is reused even if the client
 * omits `mcp-session-id` or sends a stale ID — fixes Cursor and similar clients that drop
 * or cache the wrong header while JSON response mode is enabled.
 */
function useStrictSessionRouting(): boolean {
  const v = process.env["MCP_HTTP_STRICT_SESSIONS"]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Detect MCP initialize in a POST body (single JSON-RPC message or batch array). */
export function requestBodyContainsInitialize(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((msg) => isInitializeRequest(msg));
  }
  return isInitializeRequest(body);
}

/**
 * JSON responses avoid POST+SSE lifecycle quirks that break some MCP HTTP clients after the first request.
 * Set `MCP_HTTP_JSON_RESPONSE=0` for legacy SSE POST responses (+ optional event store resumption).
 */
function useJsonResponseMode(): boolean {
  const v = process.env["MCP_HTTP_JSON_RESPONSE"]?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "sse") return false;
  return true;
}

export type HubstaffHttpServerBundle = {
  app: Express;
  /** Close all MCP Streamable HTTP sessions (each transport). */
  closeAllSessions: () => Promise<void>;
};

/**
 * Express app: `/health` plus Streamable HTTP MCP on `/mcp`.
 */
export function createHubstaffHttpApp(client: HubstaffClient, version: string): HubstaffHttpServerBundle {
  const host = process.env["MCP_HTTP_HOST"] ?? "0.0.0.0";
  const app = createMcpExpressApp({ host });

  /**
   * Serialize POST /mcp: concurrent initialize requests could otherwise run disposeAllTransports()
   * while another handler still uses its transport — rare but causes flaky “No valid session ID”.
   */
  let postExclusiveChain: Promise<void> = Promise.resolve();

  const runPostExclusive = async (fn: () => Promise<void>): Promise<void> => {
    const next = postExclusiveChain.then(fn);
    postExclusiveChain = next.then(
      () => undefined,
      () => undefined,
    );
    await next;
  };

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "mcp-hubstaff",
      transport: "streamable-http",
      responseMode: useJsonResponseMode() ? "json" : "sse",
    });
  });

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const disposeAllTransports = async (): Promise<void> => {
    const ids = Object.keys(transports);
    for (const id of ids) {
      const tr = transports[id];
      if (tr !== undefined) {
        try {
          await tr.close();
        } catch {
          /* ignore */
        }
        Reflect.deleteProperty(transports, id);
      }
    }
  };

  const mcpPostHandler = async (req: Request, res: Response): Promise<void> => {
    await runPostExclusive(async () => {
      const sessionId = headerSessionId(req);
      const parsedBody = normalizeMcpPostBody(req.body);
      const existingTransport =
        sessionId !== undefined && transports[sessionId] !== undefined
          ? transports[sessionId]
          : undefined;

      try {
        if (existingTransport !== undefined) {
          await existingTransport.handleRequest(req, res, parsedBody);
          return;
        }

        if (
          typeof parsedBody === "object" &&
          parsedBody !== null &&
          requestBodyContainsInitialize(parsedBody)
        ) {
          await disposeAllTransports();

          const jsonMode = useJsonResponseMode();
          const activeTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: jsonMode,
            ...(jsonMode ? {} : { eventStore: new InMemoryEventStore() }),
            onsessioninitialized: (sid: string) => {
              transports[sid] = activeTransport;
            },
            onsessionclosed: (sid: string) => {
              Reflect.deleteProperty(transports, sid);
            },
          });

          const mcp = createHubstaffMcpServer(version, client);
          await mcp.connect(activeTransport);
          await activeTransport.handleRequest(req, res, parsedBody);
          return;
        }

        if (!useStrictSessionRouting()) {
          const ids = Object.keys(transports);
          if (
            ids.length === 1 &&
            typeof parsedBody === "object" &&
            parsedBody !== null &&
            !requestBodyContainsInitialize(parsedBody)
          ) {
            const soleSessionKey = ids[0];
            if (soleSessionKey !== undefined) {
              const onlyTransport = transports[soleSessionKey];
              if (onlyTransport !== undefined) {
                setIncomingSessionHeader(req, soleSessionKey);
                await onlyTransport.handleRequest(req, res, parsedBody);
                return;
              }
            }
          }
        }

        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
      } catch (error: unknown) {
        console.error(error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    });
  };

  const mcpGetHandler = async (req: Request, res: Response): Promise<void> => {
    const sid = headerSessionId(req);
    const existing = sid === undefined ? undefined : transports[sid];
    if (existing === undefined) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await existing.handleRequest(req, res);
  };

  const mcpDeleteHandler = async (req: Request, res: Response): Promise<void> => {
    const sid = headerSessionId(req);
    const existing = sid === undefined ? undefined : transports[sid];
    if (existing === undefined) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await existing.handleRequest(req, res);
  };

  app.post("/mcp", mcpPostHandler);
  app.get("/mcp", mcpGetHandler);
  app.delete("/mcp", mcpDeleteHandler);

  const closeAllSessions = disposeAllTransports;

  return { app, closeAllSessions };
}

/**
 * Starts MCP over Streamable HTTP (Express).
 *
 * Intended for `docker compose up -d` and MCP Inspector using an HTTP URL.
 * Sessions use an in-memory map; not durable across restarts.
 */
export async function startHubstaffHttpServer(client: HubstaffClient, version: string): Promise<void> {
  const host = process.env["MCP_HTTP_HOST"] ?? "0.0.0.0";
  const port = Number.parseInt(process.env["MCP_HTTP_PORT"] ?? "3333", 10);
  if (Number.isNaN(port)) {
    throw new Error("Invalid MCP_HTTP_PORT.");
  }

  const { app, closeAllSessions } = createHubstaffHttpApp(client, version);

  const httpServer = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(port, host, () => {
      resolve(s);
    });
    s.on("error", reject);
  });

  console.error(
    `mcp-hubstaff: Streamable HTTP MCP at http://${host}:${String(port)}/mcp (GET /health for readiness; JSON responses: ${useJsonResponseMode() ? "on" : "off"})`,
  );

  const gracefulExit = (): void => {
    void closeAllSessions().finally(() => {
      httpServer.close(() => process.exit(0));
    });
  };

  process.once("SIGINT", gracefulExit);
  process.once("SIGTERM", gracefulExit);
}
