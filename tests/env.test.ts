import { describe, expect, it } from "vitest";
import { createHubstaffFromEnv } from "../src/env.js";

describe("createHubstaffFromEnv", () => {
  it("requires a PAT or OAuth refresh token", () => {
    expect(() => createHubstaffFromEnv({})).toThrow(/HUBSTAFF_PERSONAL_ACCESS_TOKEN/);
  });

  it("rejects mixing PAT with OAuth client credentials", () => {
    expect(() =>
      createHubstaffFromEnv({
        HUBSTAFF_PERSONAL_ACCESS_TOKEN: "pat",
        HUBSTAFF_CLIENT_ID: "id",
      }),
    ).toThrow(/Do not set HUBSTAFF_CLIENT_ID/);
  });

  it("requires both client id and secret when using OAuth refresh token mode", () => {
    expect(() =>
      createHubstaffFromEnv({
        HUBSTAFF_REFRESH_TOKEN: "rt",
        HUBSTAFF_CLIENT_ID: "id",
      }),
    ).toThrow(/both HUBSTAFF_CLIENT_ID/);
  });

  it("constructs client from PAT", () => {
    const { client } = createHubstaffFromEnv({
      HUBSTAFF_PERSONAL_ACCESS_TOKEN: "pat_refresh_token",
    });
    expect(client).toBeDefined();
  });
});
