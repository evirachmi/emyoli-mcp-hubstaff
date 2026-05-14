import { describe, expect, it, vi } from "vitest";
import { HubstaffAuth } from "../src/hubstaff/auth.js";

describe("HubstaffAuth", () => {
  it("exchanges refresh token for access token", async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            token_type: "bearer",
            access_token: "access",
            expires_in: 3600,
            refresh_token: "next_refresh",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const auth = new HubstaffAuth("refresh_1");
    const token = await auth.getAccessToken(fetchMock);

    expect(token).toBe("access");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const cached = await auth.getAccessToken(fetchMock);
    expect(cached).toBe("access");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when token endpoint returns an error", async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(new Response("nope", { status: 401, statusText: "Unauthorized" })),
    );

    const auth = new HubstaffAuth("bad");

    await expect(auth.getAccessToken(fetchMock)).rejects.toThrow(/Hubstaff token refresh failed/);
  });
});
