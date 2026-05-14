#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  createHubstaffFromEnv,
  getServerVersion,
  runHealthCheck,
  shouldRunHealthCheck,
} from "./env.js";
import { registerHubstaffTools } from "./server.js";

async function main(): Promise<void> {
  if (shouldRunHealthCheck(process.argv)) {
    try {
      await runHealthCheck();
      console.error("mcp-hubstaff: health check OK");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`mcp-hubstaff: health check failed: ${message}`);
      process.exitCode = 1;
      return;
    }
    return;
  }

  const version = getServerVersion();
  const { client } = createHubstaffFromEnv();

  const mcp = new McpServer(
    { name: "mcp-hubstaff", version },
    {
      instructions:
        "Tools wrap Hubstaff API v2 reads. Configure credentials with HUBSTAFF_PERSONAL_ACCESS_TOKEN (recommended) or OAuth refresh env vars documented in the server README.",
    },
  );

  registerHubstaffTools(mcp, client);

  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
