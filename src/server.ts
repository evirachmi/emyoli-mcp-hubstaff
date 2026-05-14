import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HubstaffClient } from "./hubstaff/client.js";

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

const organizationIdSchema = z.object({
  organization_id: z.number().int().positive(),
});

const paginationSchema = z.object({
  page_start_id: z.number().int().optional(),
});

const activityFilterSchema = paginationSchema.extend({
  start_time: z.string().optional(),
  stop_time: z.string().optional(),
  user_id: z.number().int().optional(),
  project_id: z.number().int().optional(),
  task_id: z.number().int().optional(),
});

export function validateHubstaffRelativePath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, "");
  if (trimmed.length === 0) {
    throw new Error("Path must not be empty.");
  }
  if (trimmed.includes("..")) {
    throw new Error('Path must not contain "..".');
  }
  if (!/^[a-zA-Z0-9_\-/.]+$/.test(trimmed)) {
    throw new Error("Path contains unsupported characters.");
  }
  if (!(trimmed.startsWith("organizations/") || trimmed.startsWith("users/"))) {
    throw new Error('Path must start with "organizations/" or "users/".');
  }
  return trimmed;
}

export function registerHubstaffTools(server: McpServer, client: HubstaffClient): void {
  server.registerTool(
    "hubstaff_whoami",
    {
      description: "Returns the authenticated Hubstaff user (Hubstaff API v2 GET /users/me).",
    },
    async (_extra) => {
      try {
        const data = await client.getJson("users/me");
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_organizations",
    {
      description: "Lists organizations available to the authenticated user (GET /organizations).",
      inputSchema: paginationSchema,
    },
    async (args) => {
      try {
        const data = await client.getJson("organizations", {
          page_start_id: args.page_start_id,
        });
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_projects",
    {
      description: "Lists projects in an organization (GET /organizations/{organization_id}/projects).",
      inputSchema: organizationIdSchema.merge(paginationSchema),
    },
    async (args) => {
      try {
        const data = await client.getJson(`organizations/${String(args.organization_id)}/projects`, {
          page_start_id: args.page_start_id,
        });
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_members",
    {
      description:
        "Lists members of an organization (GET /organizations/{organization_id}/members). Useful for resolving user IDs.",
      inputSchema: organizationIdSchema.merge(paginationSchema),
    },
    async (args) => {
      try {
        const data = await client.getJson(`organizations/${String(args.organization_id)}/members`, {
          page_start_id: args.page_start_id,
        });
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_teams",
    {
      description: "Lists teams in an organization (GET /organizations/{organization_id}/teams).",
      inputSchema: organizationIdSchema.merge(paginationSchema),
    },
    async (args) => {
      try {
        const data = await client.getJson(`organizations/${String(args.organization_id)}/teams`, {
          page_start_id: args.page_start_id,
        });
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_tasks",
    {
      description: "Lists tasks in an organization (GET /organizations/{organization_id}/tasks).",
      inputSchema: organizationIdSchema.merge(paginationSchema),
    },
    async (args) => {
      try {
        const data = await client.getJson(`organizations/${String(args.organization_id)}/tasks`, {
          page_start_id: args.page_start_id,
        });
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_job_sites",
    {
      description: "Lists job sites configured for an organization (GET /organizations/{organization_id}/job_sites).",
      inputSchema: organizationIdSchema.merge(paginationSchema),
    },
    async (args) => {
      try {
        const data = await client.getJson(`organizations/${String(args.organization_id)}/job_sites`, {
          page_start_id: args.page_start_id,
        });
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_activities",
    {
      description:
        "Lists raw activity records for an organization (GET /organizations/{organization_id}/activities). Narrow start_time/stop_time when possible (Hubstaff may timeout on large ranges).",
      inputSchema: organizationIdSchema.merge(activityFilterSchema),
    },
    async (args) => {
      try {
        const { organization_id, ...query } = args;
        const data = await client.getJson(`organizations/${String(organization_id)}/activities`, query);
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_daily_activities",
    {
      description:
        "Lists daily aggregated activities for an organization (GET /organizations/{organization_id}/activities/daily). Prefer this for reporting-style summaries.",
      inputSchema: organizationIdSchema.merge(activityFilterSchema),
    },
    async (args) => {
      try {
        const { organization_id, ...query } = args;
        const data = await client.getJson(`organizations/${String(organization_id)}/activities/daily`, query);
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_timesheets",
    {
      description: "Lists timesheets for an organization (GET /organizations/{organization_id}/timesheets).",
      inputSchema: organizationIdSchema.merge(activityFilterSchema),
    },
    async (args) => {
      try {
        const { organization_id, ...query } = args;
        const data = await client.getJson(`organizations/${String(organization_id)}/timesheets`, query);
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_list_screenshots",
    {
      description: "Lists screenshots captured for an organization (GET /organizations/{organization_id}/screenshots).",
      inputSchema: organizationIdSchema.merge(activityFilterSchema),
    },
    async (args) => {
      try {
        const { organization_id, ...query } = args;
        const data = await client.getJson(`organizations/${String(organization_id)}/screenshots`, query);
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_get_user",
    {
      description: "Gets a Hubstaff user by numeric ID (GET /users/{user_id}).",
      inputSchema: z.object({
        user_id: z.number().int().positive(),
      }),
    },
    async (args) => {
      try {
        const data = await client.getJson(`users/${String(args.user_id)}`);
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_api_get",
    {
      description:
        "Low-level GET helper for Hubstaff API v2. Path is relative to /v2 (example: organizations/123/projects). Only prefixes organizations/* and users/* are allowed.",
      inputSchema: z.object({
        path: z.string().min(1),
        query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
      }),
    },
    async (args) => {
      try {
        const safePath = validateHubstaffRelativePath(args.path);
        const flatQuery: Record<string, string | number | boolean | undefined> | undefined =
          args.query === undefined
            ? undefined
            : Object.fromEntries(Object.entries(args.query).map(([k, v]) => [k, v]));
        const data = await client.getJson(safePath, flatQuery);
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
