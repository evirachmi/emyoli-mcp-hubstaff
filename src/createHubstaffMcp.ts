import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HubstaffClient } from "./hubstaff/client.js";
import { registerHubstaffTools } from "./server.js";

export function createHubstaffMcpServer(version: string, client: HubstaffClient): McpServer {
  const mcp = new McpServer(
    { name: "mcp-hubstaff", version },
    {
      instructions:
        "Tools wrap Hubstaff API v2 reads and selected writes (time entries, projects, tasks). To remove time shown in list_activities, use hubstaff_delete_activity with the activity row id and organization_id — not hubstaff_delete_time_entry (that is for a different id type). Destructive tools are labeled in their descriptions. Configure credentials with HUBSTAFF_PERSONAL_ACCESS_TOKEN (recommended) or OAuth refresh env vars documented in the server README; tokens must include scopes Hubstaff requires for write endpoints.",
    },
  );

  registerHubstaffTools(mcp, client);

  return mcp;
}
