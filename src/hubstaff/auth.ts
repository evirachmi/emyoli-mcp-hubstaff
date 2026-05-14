export const HUBSTAFF_TOKEN_URL = "https://account.hubstaff.com/access_tokens";
export const HUBSTAFF_API_BASE = "https://api.hubstaff.com/v2";

export type HubstaffTokenResponse = {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
};

export type HubstaffAuthOptions = {
  /**
   * OAuth application client id (optional). When set with clientSecret, requests use HTTP Basic auth.
   */
  clientId?: string | undefined;
  /**
   * OAuth application client secret (optional).
   */
  clientSecret?: string | undefined;
};

/**
 * Exchanges and caches Hubstaff access tokens using a refresh token.
 *
 * Personal access tokens (PAT) from Hubstaff are long-lived refresh tokens; exchange them
 * using grant_type=refresh_token without client credentials (see Hubstaff docs).
 */
export class HubstaffAuth {
  private accessToken: string | undefined;
  private accessTokenExpiresAtUnix = 0;
  private refreshTokenValue: string;
  /** Ensures parallel callers share one refresh (Hubstaff rate-limits refresh per token). */
  private refreshInFlight: Promise<string> | null = null;

  constructor(
    refreshToken: string,
    private readonly options: HubstaffAuthOptions = {},
  ) {
    this.refreshTokenValue = refreshToken;
  }

  async getAccessToken(fetchFn: typeof fetch = fetch): Promise<string> {
    const now = Date.now() / 1000;
    if (this.accessToken !== undefined && now < this.accessTokenExpiresAtUnix - 60) {
      return this.accessToken;
    }

    if (this.refreshInFlight !== null) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.exchangeRefreshToken(fetchFn).finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  private async exchangeRefreshToken(fetchFn: typeof fetch): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshTokenValue,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };

    const { clientId, clientSecret } = this.options;
    if (clientId !== undefined && clientSecret !== undefined) {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
    }

    const response = await fetchFn(HUBSTAFF_TOKEN_URL, {
      method: "POST",
      headers,
      body,
    });

    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(
        `Hubstaff token refresh failed (${String(response.status)} ${response.statusText}): ${rawBody}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody) as unknown;
    } catch {
      throw new Error(`Hubstaff token refresh returned non-JSON: ${rawBody}`);
    }

    const token = parsed as Partial<HubstaffTokenResponse>;
    if (
      typeof token.access_token !== "string" ||
      typeof token.expires_in !== "number" ||
      typeof token.refresh_token !== "string"
    ) {
      throw new Error(`Hubstaff token refresh returned unexpected JSON: ${rawBody}`);
    }

    this.accessToken = token.access_token;
    this.accessTokenExpiresAtUnix = Date.now() / 1000 + token.expires_in;
    this.refreshTokenValue = token.refresh_token;

    return this.accessToken;
  }
}
