/**
 * Hubstaff API v2 list endpoints use bracketed query keys (`time_slot[start]`, `date[start]`, …),
 * not `start_time` / `stop_time`. Map our tool args to the wire format.
 */

export type ActivityFilterArgs = {
  page_start_id?: number | undefined;
  start_time?: string | undefined;
  stop_time?: string | undefined;
  user_id?: number | undefined;
  project_id?: number | undefined;
  task_id?: number | undefined;
};

/** GET …/activities — uses `time_slot` + `user_ids`. */
export function buildActivitiesListQuery(args: ActivityFilterArgs): Record<string, string | number | undefined> {
  const q: Record<string, string | number | undefined> = {};
  if (args.page_start_id !== undefined) q.page_start_id = args.page_start_id;
  if (args.start_time !== undefined) q["time_slot[start]"] = args.start_time;
  if (args.stop_time !== undefined) q["time_slot[stop]"] = args.stop_time;
  if (args.user_id !== undefined) q.user_ids = args.user_id;
  if (args.project_id !== undefined) q.project_id = args.project_id;
  if (args.task_id !== undefined) q.task_id = args.task_id;
  return q;
}

/** Normalize to YYYY-MM-DD for Hubstaff `date[start]` / `date[stop]`. */
function toHubstaffDate(s: string): string {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const prefix = t.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(prefix)) return prefix;
  return t;
}

/** GET …/activities/daily — uses `date[start]` / `date[stop]` + `user_ids`. */
export function buildDailyActivitiesQuery(args: ActivityFilterArgs): Record<string, string | number | undefined> {
  const q: Record<string, string | number | undefined> = {};
  if (args.page_start_id !== undefined) q.page_start_id = args.page_start_id;
  if (args.start_time !== undefined) q["date[start]"] = toHubstaffDate(args.start_time);
  if (args.stop_time !== undefined) q["date[stop]"] = toHubstaffDate(args.stop_time);
  if (args.user_id !== undefined) q.user_ids = args.user_id;
  if (args.project_id !== undefined) q.project_id = args.project_id;
  if (args.task_id !== undefined) q.task_id = args.task_id;
  return q;
}
