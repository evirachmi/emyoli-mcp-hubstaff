import type { HubstaffAuth } from "./auth.js";
import { HUBSTAFF_API_BASE } from "./auth.js";

export type HubstaffClientOptions = {
  apiBaseUrl?: string | undefined;
};

export class HubstaffClient {
  constructor(
    private readonly auth: HubstaffAuth,
    private readonly options: HubstaffClientOptions = {},
  ) {}

  async getJson(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
    fetchFn: typeof fetch = fetch,
  ): Promise<unknown> {
    const trimmedPath = path.replace(/^\/+/, "");
    const base = this.options.apiBaseUrl ?? HUBSTAFF_API_BASE;
    const url = new URL(`${base.replace(/\/+$/, "")}/${trimmedPath}`);

    if (query !== undefined) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        if (value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }

    const token = await this.auth.getAccessToken(fetchFn);
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Hubstaff API error (${String(response.status)}) GET ${url.pathname}${url.search}: ${text}`);
    }

    if (text.length === 0) return null;

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error(`Hubstaff API returned non-JSON for GET ${url.pathname}${url.search}: ${text}`);
    }
  }
}
