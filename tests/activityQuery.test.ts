import { describe, expect, it } from "vitest";
import { buildActivitiesListQuery, buildDailyActivitiesQuery } from "../src/hubstaff/activityQuery.js";

describe("buildActivitiesListQuery", () => {
  it("maps start_time/stop_time to time_slot bracket keys and user_id to user_ids", () => {
    expect(
      buildActivitiesListQuery({
        start_time: "2026-05-14T00:00:00Z",
        stop_time: "2026-05-15T00:00:00Z",
        user_id: 8824,
        project_id: 1220754,
      }),
    ).toEqual({
      "time_slot[start]": "2026-05-14T00:00:00Z",
      "time_slot[stop]": "2026-05-15T00:00:00Z",
      user_ids: 8824,
      project_id: 1220754,
    });
  });
});

describe("buildDailyActivitiesQuery", () => {
  it("maps to date[start]/date[stop] as YYYY-MM-DD", () => {
    expect(
      buildDailyActivitiesQuery({
        start_time: "2026-04-01T00:00:00Z",
        stop_time: "2026-04-30",
        user_id: 1,
      }),
    ).toEqual({
      "date[start]": "2026-04-01",
      "date[stop]": "2026-04-30",
      user_ids: 1,
    });
  });
});
