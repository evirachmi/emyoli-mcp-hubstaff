import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HubstaffClient } from "./hubstaff/client.js";
import { registerHubstaffTools } from "./server.js";

export function createHubstaffMcpServer(version: string, client: HubstaffClient): McpServer {
  const mcp = new McpServer(
    { name: "mcp-hubstaff", version },
    {
      instructions:
        "Tools wrap Hubstaff API v2 reads. Configure credentials with HUBSTAFF_PERSONAL_ACCESS_TOKEN (recommended) or OAuth refresh env vars documented in the server README.",
    },
  );

  registerHubstaffTools(mcp, client);

  return mcp;
}
