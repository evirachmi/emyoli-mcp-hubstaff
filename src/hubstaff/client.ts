import type { HubstaffAuth } from "./auth.js";
import { HUBSTAFF_API_BASE } from "./auth.js";

export type HubstaffClientOptions = {
  apiBaseUrl?: string | undefined;
};

export type HubstaffJsonMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class HubstaffClient {
  constructor(
    private readonly auth: HubstaffAuth,
    private readonly options: HubstaffClientOptions = {},
  ) {}

  private apiUrl(path: string): URL {
    const trimmedPath = path.replace(/^\/+/, "");
    const base = this.options.apiBaseUrl ?? HUBSTAFF_API_BASE;
    return new URL(`${base.replace(/\/+$/, "")}/${trimmedPath}`);
  }

  private applyQuery(url: URL, query?: Record<string, string | number | boolean | undefined>): void {
    if (query === undefined) return;
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  /**
   * Authenticated JSON request against Hubstaff API v2.
   * Empty or non-JSON bodies (e.g. HTTP 204) resolve to `null`.
   */
  async jsonRequest(
    method: HubstaffJsonMethod,
    path: string,
    options?: {
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    },
    fetchFn: typeof fetch = fetch,
  ): Promise<unknown> {
    const url = this.apiUrl(path);
    this.applyQuery(url, options?.query);

    const token = await this.auth.getAccessToken(fetchFn);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    const body = options?.body;
    const init: RequestInit = {
      method,
      headers,
    };

    if (method !== "GET" && method !== "DELETE" && body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetchFn(url, init);

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Hubstaff API error (${String(response.status)}) ${method} ${url.pathname}${url.search}: ${text}`,
      );
    }

    if (text.length === 0 || response.status === 204) return null;

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error(`Hubstaff API returned non-JSON for ${method} ${url.pathname}${url.search}: ${text}`);
    }
  }

  async getJson(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
    fetchFn: typeof fetch = fetch,
  ): Promise<unknown> {
    return this.jsonRequest("GET", path, { query }, fetchFn);
  }

  async postJson(
    path: string,
    body: unknown,
    fetchFn: typeof fetch = fetch,
  ): Promise<unknown> {
    return this.jsonRequest("POST", path, { body }, fetchFn);
  }

  async putJson(path: string, body: unknown, fetchFn: typeof fetch = fetch): Promise<unknown> {
    return this.jsonRequest("PUT", path, { body }, fetchFn);
  }

  async deleteJson(path: string, fetchFn: typeof fetch = fetch): Promise<unknown> {
    return this.jsonRequest("DELETE", path, undefined, fetchFn);
  }
}
