import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { Request, Response } from "express";
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

/** Detect MCP initialize in a POST body (single JSON-RPC message or batch array). */
export function requestBodyContainsInitialize(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((msg) => isInitializeRequest(msg));
  }
  return isInitializeRequest(body);
}

/**
 * Starts MCP over Streamable HTTP (Express).
 *
 * Intended for `docker compose up -d` and MCP Inspector using an HTTP URL.
 * Sessions use an in-memory event store (from SDK examples); not durable across restarts.
 */
export async function startHubstaffHttpServer(client: HubstaffClient, version: string): Promise<void> {
  const host = process.env["MCP_HTTP_HOST"] ?? "0.0.0.0";
  const port = Number.parseInt(process.env["MCP_HTTP_PORT"] ?? "3333", 10);
  if (Number.isNaN(port)) {
    throw new Error("Invalid MCP_HTTP_PORT.");
  }

  const app = createMcpExpressApp({ host });

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: "mcp-hubstaff", transport: "streamable-http" });
  });

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const mcpPostHandler = async (req: Request, res: Response): Promise<void> => {
    const sessionId = headerSessionId(req);
    const existingTransport =
      sessionId !== undefined && transports[sessionId] !== undefined
        ? transports[sessionId]
        : undefined;

    try {
      if (existingTransport !== undefined) {
        await existingTransport.handleRequest(req, res, req.body);
        return;
      }

      if (
        typeof req.body === "object" &&
        req.body !== null &&
        requestBodyContainsInitialize(req.body)
      ) {
        const eventStore = new InMemoryEventStore();
        const activeTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore,
          onsessioninitialized: (sid: string) => {
            transports[sid] = activeTransport;
          },
        });

        activeTransport.onclose = () => {
          const sid = activeTransport.sessionId;
          if (sid !== undefined) {
            Reflect.deleteProperty(transports, sid);
          }
        };

        const mcp = createHubstaffMcpServer(version, client);
        await mcp.connect(activeTransport);
        await activeTransport.handleRequest(req, res, req.body);
        return;
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
  };

  const mcpGetHandler = async (req: Request, res: Response): Promise<void> => {
    const sessionId = headerSessionId(req);
    const existing = sessionId === undefined ? undefined : transports[sessionId];
    if (existing === undefined) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await existing.handleRequest(req, res);
  };

  const mcpDeleteHandler = async (req: Request, res: Response): Promise<void> => {
    const sessionId = headerSessionId(req);
    const existing = sessionId === undefined ? undefined : transports[sessionId];
    if (existing === undefined) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await existing.handleRequest(req, res);
  };

  app.post("/mcp", mcpPostHandler);
  app.get("/mcp", mcpGetHandler);
  app.delete("/mcp", mcpDeleteHandler);

  await new Promise<void>((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      resolve();
    });
    httpServer.on("error", reject);
  });

  console.error(
    `mcp-hubstaff: Streamable HTTP MCP at http://${host}:${String(port)}/mcp (GET /health for readiness)`,
  );

  const shutdown = async (): Promise<void> => {
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

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });
}
