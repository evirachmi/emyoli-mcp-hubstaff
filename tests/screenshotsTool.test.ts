import { describe, expect, it } from "vitest";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type z } from "zod";
import { registerHubstaffTools } from "../src/server.js";
import { type HubstaffClient } from "../src/hubstaff/client.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
interface ToolConfig {
  inputSchema?: z.ZodTypeAny;
}

/**
 * Register the real tools against a fake server that just captures each tool's handler and config,
 * so we can invoke a handler directly and inspect the exact call it makes to the Hubstaff client.
 */
function collectTools(client: HubstaffClient): {
  handlers: Map<string, ToolHandler>;
  configs: Map<string, ToolConfig>;
} {
  const handlers = new Map<string, ToolHandler>();
  const configs = new Map<string, ToolConfig>();
  const fakeServer = {
    registerTool(name: string, config: ToolConfig, handler: ToolHandler): void {
      handlers.set(name, handler);
      configs.set(name, config);
    },
  } as unknown as McpServer;
  registerHubstaffTools(fakeServer, client);
  return { handlers, configs };
}

describe("hubstaff_list_screenshots handler", () => {
  it("maps start_time/stop_time to time_slot brackets and user_id to user_ids on the screenshots path", async () => {
    const calls: { path: string; query?: Record<string, unknown> }[] = [];
    const client = {
      getJson: (path: string, query?: Record<string, unknown>): Promise<unknown> => {
        calls.push({ path, query });
        return Promise.resolve({ screenshots: [] });
      },
    } as unknown as HubstaffClient;

    const { handlers } = collectTools(client);
    const handler = handlers.get("hubstaff_list_screenshots");
    if (handler === undefined) throw new Error("hubstaff_list_screenshots was not registered");

    await handler({
      organization_id: 370362,
      start_time: "2026-07-03T00:00:00Z",
      stop_time: "2026-07-03T23:59:59Z",
      user_id: 1608751,
    });

    // Regression guard: the previous bug forwarded start_time/stop_time/user_id raw, which the
    // Hubstaff screenshots endpoint rejects with "time_slot is missing".
    expect(calls).toEqual([
      {
        path: "organizations/370362/screenshots",
        query: {
          "time_slot[start]": "2026-07-03T00:00:00Z",
          "time_slot[stop]": "2026-07-03T23:59:59Z",
          user_ids: 1608751,
        },
      },
    ]);
  });

  it("requires non-empty start_time and stop_time in its input schema", () => {
    const client = {
      getJson: (): Promise<unknown> => Promise.resolve({}),
    } as unknown as HubstaffClient;

    const { configs } = collectTools(client);
    const schema = configs.get("hubstaff_list_screenshots")?.inputSchema;
    if (schema === undefined) throw new Error("hubstaff_list_screenshots has no input schema");

    expect(schema.safeParse({ organization_id: 370362 }).success).toBe(false);
    expect(schema.safeParse({ organization_id: 370362, start_time: "", stop_time: "" }).success).toBe(false);
    expect(
      schema.safeParse({
        organization_id: 370362,
        start_time: "2026-07-03T00:00:00Z",
        stop_time: "2026-07-03T23:59:59Z",
      }).success,
    ).toBe(true);
  });
});
