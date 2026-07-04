import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildActivitiesListQuery, buildDailyActivitiesQuery } from "./hubstaff/activityQuery.js";
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

// The screenshots endpoint requires time_slot[start]/time_slot[stop]; a call without them returns a
// Hubstaff 400. Enforce required, non-empty timestamps here so the error surfaces at the MCP
// boundary rather than downstream. (task_id is omitted: the endpoint silently ignores it.)
const screenshotFilterSchema = paginationSchema.extend({
  start_time: z.string().min(1),
  stop_time: z.string().min(1),
  user_id: z.number().int().optional(),
  project_id: z.number().int().optional(),
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
        "Lists raw activity records for an organization (GET /organizations/{organization_id}/activities). Pass start_time/stop_time (ISO); these are sent as time_slot[start]/time_slot[stop]. Pass user_id → user_ids. Narrow the range when possible (Hubstaff may timeout on large ranges). Use activity `id` with hubstaff_delete_activity to remove a segment.",
      inputSchema: organizationIdSchema.merge(activityFilterSchema),
    },
    async (args) => {
      try {
        const { organization_id, ...rest } = args;
        const query = buildActivitiesListQuery(rest);
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
        "Lists daily aggregated activities for an organization (GET /organizations/{organization_id}/activities/daily). Prefer this for reporting-style summaries. Uses Hubstaff `date[start]` / `date[stop]` (map from start_time/stop_time).",
      inputSchema: organizationIdSchema.merge(activityFilterSchema),
    },
    async (args) => {
      try {
        const { organization_id, ...rest } = args;
        const query = buildDailyActivitiesQuery(rest);
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
      description:
        "Lists screenshots captured for an organization (GET /organizations/{organization_id}/screenshots). start_time/stop_time are REQUIRED and map to time_slot[start]/time_slot[stop]; user_id maps to user_ids. Paginate with page_start_id (the response returns pagination.next_page_start_id). The screenshots endpoint ignores task_id.",
      inputSchema: organizationIdSchema.merge(screenshotFilterSchema),
    },
    async (args) => {
      try {
        const { organization_id, ...rest } = args;
        const query = buildActivitiesListQuery(rest);
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

  const createTimeEntrySchema = z.object({
    user_id: z.number().int().positive(),
    project_id: z.number().int().positive(),
    start_time: z.string().min(1),
    tracked: z.number().int().nonnegative(),
    billable: z.boolean().optional(),
    note: z.string().optional(),
    task_id: z.number().int().positive().optional(),
  });

  server.registerTool(
    "hubstaff_create_time_entry",
    {
      description:
        "WRITE: Creates a manual time entry for a user on a project (Hubstaff API v2 POST /users/{user_id}/time_entries). `tracked` is duration in seconds. Requires a token/PAT with write scopes (see Hubstaff docs).",
      inputSchema: createTimeEntrySchema,
    },
    async (args) => {
      try {
        const time_entry: Record<string, unknown> = {
          project_id: args.project_id,
          start_time: args.start_time,
          tracked: args.tracked,
        };
        if (args.billable !== undefined) time_entry.billable = args.billable;
        if (args.note !== undefined && args.note !== "") time_entry.note = args.note;
        if (args.task_id !== undefined) time_entry.task_id = args.task_id;

        // Hubstaff rejects nested `time_entry` here; send attributes at the root body.
        const data = await client.postJson(`users/${String(args.user_id)}/time_entries`, time_entry);
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_delete_time_entry",
    {
      description:
        "WRITE / DESTRUCTIVE: Deletes by Hubstaff time_entry id (DELETE /users/{user_id}/time_entries/{time_entry_id}). That id is not the same as activity row ids from list_activities — use hubstaff_delete_activity for those. Requires write scopes.",
      inputSchema: z.object({
        user_id: z.number().int().positive(),
        time_entry_id: z.number().int().positive(),
      }),
    },
    async (args) => {
      try {
        const data = await client.deleteJson(
          `users/${String(args.user_id)}/time_entries/${String(args.time_entry_id)}`,
        );
        return jsonResult(data ?? { deleted: true, time_entry_id: args.time_entry_id });
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_delete_activity",
    {
      description:
        "WRITE / DESTRUCTIVE: Deletes one activity row (10-minute segment), including manual time blocks returned by hubstaff_list_activities (DELETE /organizations/{organization_id}/activities/{activity_id}). Pass the numeric `id` field from an activity object. Requires write scopes on the PAT.",
      inputSchema: z.object({
        organization_id: z.number().int().positive(),
        activity_id: z.number().int().positive(),
      }),
    },
    async (args) => {
      try {
        const data = await client.deleteJson(
          `organizations/${String(args.organization_id)}/activities/${String(args.activity_id)}`,
        );
        return jsonResult(
          data ?? { deleted: true, organization_id: args.organization_id, activity_id: args.activity_id },
        );
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_create_project",
    {
      description:
        "WRITE: Creates a project in an organization (POST /organizations/{organization_id}/projects). Requires write scopes.",
      inputSchema: organizationIdSchema.extend({
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const project: Record<string, unknown> = { name: args.name };
        if (args.description !== undefined && args.description !== "") {
          project.description = args.description;
        }
        const data = await client.postJson(`organizations/${String(args.organization_id)}/projects`, {
          project,
        });
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  const updateProjectSchema = z
    .object({
      project_id: z.number().int().positive(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(["active", "archived", "inactive"]).optional(),
    })
    .superRefine((val, ctx) => {
      if (val.name === undefined && val.description === undefined && val.status === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide at least one of name, description, or status.",
        });
      }
    });

  server.registerTool(
    "hubstaff_update_project",
    {
      description:
        "WRITE: Updates a project by ID (PUT /projects/{project_id}). Requires write scopes.",
      inputSchema: updateProjectSchema,
    },
    async (args) => {
      try {
        const project: Record<string, unknown> = {};
        if (args.name !== undefined) project.name = args.name;
        if (args.description !== undefined) project.description = args.description;
        if (args.status !== undefined) project.status = args.status;

        const data = await client.putJson(`projects/${String(args.project_id)}`, { project });
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "hubstaff_create_task",
    {
      description:
        "WRITE: Creates a task in an organization (POST /organizations/{organization_id}/tasks). Optionally link to a project or assignee. Requires write scopes.",
      inputSchema: organizationIdSchema.extend({
        name: z.string().min(1),
        description: z.string().optional(),
        project_id: z.number().int().positive().optional(),
        user_id: z.number().int().positive().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const task: Record<string, unknown> = { name: args.name };
        if (args.description !== undefined && args.description !== "") task.description = args.description;
        if (args.project_id !== undefined) task.project_id = args.project_id;
        if (args.user_id !== undefined) task.user_id = args.user_id;
        if (args.status !== undefined && args.status !== "") task.status = args.status;
        if (args.priority !== undefined && args.priority !== "") task.priority = args.priority;

        const data = await client.postJson(`organizations/${String(args.organization_id)}/tasks`, {
          task,
        });
        return jsonResult(data);
      } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
