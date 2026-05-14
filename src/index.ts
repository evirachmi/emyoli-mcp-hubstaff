#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHubstaffMcpServer } from "./createHubstaffMcp.js";
import {
  createHubstaffFromEnv,
  getServerVersion,
  runHealthCheck,
  shouldRunHealthCheck,
} from "./env.js";
import { startHubstaffHttpServer } from "./httpTransport.js";

function useHttpTransport(): boolean {
  return process.env["MCP_TRANSPORT"]?.trim().toLowerCase() === "http";
}

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

  if (useHttpTransport()) {
    await startHubstaffHttpServer(client, version);
    return;
  }

  const mcp = createHubstaffMcpServer(version, client);
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
