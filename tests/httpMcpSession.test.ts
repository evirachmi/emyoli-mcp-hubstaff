import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createHubstaffHttpApp } from "../src/httpTransport.js";
import type { HubstaffClient } from "../src/hubstaff/client.js";

/** Required by MCP Streamable HTTP POST validation (SDK checks Accept includes both). */
const MCP_ACCEPT = "application/json, text/event-stream";

function stubHubstaffClient(): HubstaffClient {
  return {
    getJson: async () => ({}),
    jsonRequest: async () => ({}),
    postJson: async () => ({}),
    putJson: async () => ({}),
    deleteJson: async () => null,
  } as unknown as HubstaffClient;
}

describe("Streamable HTTP MCP session reuse", () => {
  const prevJson = process.env["MCP_HTTP_JSON_RESPONSE"];
  const prevHost = process.env["MCP_HTTP_HOST"];
  const prevStrict = process.env["MCP_HTTP_STRICT_SESSIONS"];

  beforeEach(() => {
    process.env["MCP_HTTP_HOST"] = "127.0.0.1";
  });

  afterEach(() => {
    if (prevJson === undefined) {
      Reflect.deleteProperty(process.env, "MCP_HTTP_JSON_RESPONSE");
    } else {
      process.env["MCP_HTTP_JSON_RESPONSE"] = prevJson;
    }
    if (prevHost === undefined) {
      Reflect.deleteProperty(process.env, "MCP_HTTP_HOST");
    } else {
      process.env["MCP_HTTP_HOST"] = prevHost;
    }
    if (prevStrict === undefined) {
      Reflect.deleteProperty(process.env, "MCP_HTTP_STRICT_SESSIONS");
    } else {
      process.env["MCP_HTTP_STRICT_SESSIONS"] = prevStrict;
    }
  });

  it("allows initialize then multiple POSTs on the same session (JSON response mode)", async () => {
    Reflect.deleteProperty(process.env, "MCP_HTTP_JSON_RESPONSE");

    const { app, closeAllSessions } = createHubstaffHttpApp(stubHubstaffClient(), "0.0.0-test");

    const server = await new Promise<Server>((resolve, reject) => {
      const s = app.listen(0, "127.0.0.1", () => {
        resolve(s);
      });
      s.on("error", reject);
    });

    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${String(port)}`;

    try {
      const health = await fetch(`${base}/health`);
      expect(health.ok).toBe(true);
      const healthJson = (await health.json()) as { responseMode?: string };
      expect(healthJson.responseMode).toBe("json");

      const initRes = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          Accept: MCP_ACCEPT,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "vitest", version: "0" },
          },
          id: 1,
        }),
      });

      expect(initRes.ok).toBe(true);
      expect(initRes.headers.get("content-type")?.includes("application/json")).toBe(true);

      const sessionId = initRes.headers.get("mcp-session-id");
      expect(sessionId).toBeTruthy();
      const sid = sessionId as string;

      const initBody = (await initRes.json()) as {
        jsonrpc: string;
        id: number;
        result: { protocolVersion: string };
      };
      expect(initBody.result.protocolVersion).toBeTruthy();

      const protocolVersion = initBody.result.protocolVersion;

      for (let i = 0; i < 3; i++) {
        const listRes = await fetch(`${base}/mcp`, {
          method: "POST",
          headers: {
            Accept: MCP_ACCEPT,
            "Content-Type": "application/json",
            "mcp-session-id": sid,
            "mcp-protocol-version": protocolVersion,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/list",
            id: i + 10,
          }),
        });

        expect(listRes.ok, `tools/list round ${String(i)}`).toBe(true);
        const listBody = (await listRes.json()) as {
          result?: { tools: unknown[] };
          error?: unknown;
        };
        expect(listBody.error, JSON.stringify(listBody)).toBeUndefined();
        expect(Array.isArray(listBody.result?.tools)).toBe(true);
      }
    } finally {
      await closeAllSessions();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  });

  it("accepts tools/list without mcp-session-id when exactly one session exists (single-session fallback)", async () => {
    Reflect.deleteProperty(process.env, "MCP_HTTP_JSON_RESPONSE");

    const { app, closeAllSessions } = createHubstaffHttpApp(stubHubstaffClient(), "0.0.0-test");

    const server = await new Promise<Server>((resolve, reject) => {
      const s = app.listen(0, "127.0.0.1", () => {
        resolve(s);
      });
      s.on("error", reject);
    });

    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${String(port)}`;

    try {
      const initRes = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          Accept: MCP_ACCEPT,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "vitest", version: "0" },
          },
          id: 1,
        }),
      });

      expect(initRes.ok).toBe(true);
      const initBody = (await initRes.json()) as {
        result: { protocolVersion: string };
      };
      const protocolVersion = initBody.result.protocolVersion;

      const listRes = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          Accept: MCP_ACCEPT,
          "Content-Type": "application/json",
          "mcp-protocol-version": protocolVersion,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 2,
        }),
      });

      expect(listRes.ok).toBe(true);
      const listBody = (await listRes.json()) as { result?: { tools: unknown[] }; error?: unknown };
      expect(listBody.error).toBeUndefined();
      expect(Array.isArray(listBody.result?.tools)).toBe(true);
    } finally {
      await closeAllSessions();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  });

  it("accepts tools/list with a stale mcp-session-id when exactly one session exists", async () => {
    Reflect.deleteProperty(process.env, "MCP_HTTP_JSON_RESPONSE");

    const { app, closeAllSessions } = createHubstaffHttpApp(stubHubstaffClient(), "0.0.0-test");

    const server = await new Promise<Server>((resolve, reject) => {
      const s = app.listen(0, "127.0.0.1", () => {
        resolve(s);
      });
      s.on("error", reject);
    });

    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${String(port)}`;

    try {
      const initRes = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          Accept: MCP_ACCEPT,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "vitest", version: "0" },
          },
          id: 1,
        }),
      });

      expect(initRes.ok).toBe(true);
      const initBody = (await initRes.json()) as {
        result: { protocolVersion: string };
      };
      const protocolVersion = initBody.result.protocolVersion;

      const listRes = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          Accept: MCP_ACCEPT,
          "Content-Type": "application/json",
          "mcp-session-id": "00000000-0000-4000-8000-000000000000",
          "mcp-protocol-version": protocolVersion,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 2,
        }),
      });

      expect(listRes.ok).toBe(true);
      const listBody = (await listRes.json()) as { result?: { tools: unknown[] }; error?: unknown };
      expect(listBody.error).toBeUndefined();
      expect(Array.isArray(listBody.result?.tools)).toBe(true);
    } finally {
      await closeAllSessions();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  });

  it("rejects tools/list without session header when MCP_HTTP_STRICT_SESSIONS is enabled", async () => {
    Reflect.deleteProperty(process.env, "MCP_HTTP_JSON_RESPONSE");
    process.env["MCP_HTTP_STRICT_SESSIONS"] = "1";

    const { app, closeAllSessions } = createHubstaffHttpApp(stubHubstaffClient(), "0.0.0-test");

    const server = await new Promise<Server>((resolve, reject) => {
      const s = app.listen(0, "127.0.0.1", () => {
        resolve(s);
      });
      s.on("error", reject);
    });

    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${String(port)}`;

    try {
      const initRes = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          Accept: MCP_ACCEPT,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "vitest", version: "0" },
          },
          id: 1,
        }),
      });

      expect(initRes.ok).toBe(true);
      const initBody = (await initRes.json()) as {
        result: { protocolVersion: string };
      };
      const protocolVersion = initBody.result.protocolVersion;

      const listRes = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          Accept: MCP_ACCEPT,
          "Content-Type": "application/json",
          "mcp-protocol-version": protocolVersion,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 2,
        }),
      });

      expect(listRes.ok).toBe(false);
      const errBody = (await listRes.json()) as { error?: { message?: string } };
      expect(errBody.error?.message).toContain("No valid session ID provided");
    } finally {
      await closeAllSessions();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  });
});
