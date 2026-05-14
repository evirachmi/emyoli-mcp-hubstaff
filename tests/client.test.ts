import { describe, expect, it, vi } from "vitest";
import { HubstaffAuth } from "../src/hubstaff/auth.js";
import { HubstaffClient } from "../src/hubstaff/client.js";

describe("HubstaffClient mutations", () => {
  it("postJson sends JSON body and parses response", async () => {
    const auth = new HubstaffAuth("dummy-refresh");
    vi.spyOn(auth, "getAccessToken").mockResolvedValue("access-token");

    let seenHref = "";
    let capturedInit: RequestInit | undefined;

    const fetchMock = vi.fn(async (resource: URL | string, init?: RequestInit): Promise<Response> => {
      capturedInit = init;
      seenHref = resource instanceof URL ? resource.href : resource;
      return new Response(JSON.stringify({ project: { id: 1, name: "Alpha" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new HubstaffClient(auth, { apiBaseUrl: "https://api.hubstaff.com/v2" });
    const data = await client.postJson("organizations/42/projects", { project: { name: "Alpha" } }, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seenHref).toBe("https://api.hubstaff.com/v2/organizations/42/projects");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toMatchObject({
      Authorization: "Bearer access-token",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(capturedInit?.body).toBe(JSON.stringify({ project: { name: "Alpha" } }));
    expect(data).toEqual({ project: { id: 1, name: "Alpha" } });
  });

  it("deleteJson omits body", async () => {
    const auth = new HubstaffAuth("dummy-refresh");
    vi.spyOn(auth, "getAccessToken").mockResolvedValue("access-token");

    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_resource: URL | string, init?: RequestInit): Promise<Response> => {
      capturedInit = init;
      return new Response("", { status: 200 });
    });

    const client = new HubstaffClient(auth);
    const data = await client.deleteJson("users/9/time_entries/100", fetchMock);

    expect(data).toBeNull();
    expect(capturedInit?.method).toBe("DELETE");
    expect(capturedInit?.body).toBeUndefined();
  });
});
