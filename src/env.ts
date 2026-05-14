import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { HubstaffAuthOptions } from "./hubstaff/auth.js";
import { HubstaffAuth } from "./hubstaff/auth.js";
import { HubstaffClient } from "./hubstaff/client.js";

export type HubstaffEnvConfig = {
  auth: HubstaffAuth;
  client: HubstaffClient;
};

function optionalEnv(name: string, env: NodeJS.ProcessEnv): string | undefined {
  const value = env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Loads Hubstaff credentials from environment variables.
 *
 * Supported modes:
 * - Personal access token (recommended for MCP): `HUBSTAFF_PERSONAL_ACCESS_TOKEN`
 * - OAuth refresh token: `HUBSTAFF_REFRESH_TOKEN` (+ optional `HUBSTAFF_CLIENT_ID` / `HUBSTAFF_CLIENT_SECRET`)
 */
export function createHubstaffFromEnv(env: NodeJS.ProcessEnv = process.env): HubstaffEnvConfig {
  const personalAccessToken = optionalEnv("HUBSTAFF_PERSONAL_ACCESS_TOKEN", env);
  const oauthRefresh = optionalEnv("HUBSTAFF_REFRESH_TOKEN", env);

  const refreshToken = personalAccessToken ?? oauthRefresh;
  if (refreshToken === undefined) {
    throw new Error(
      "Set HUBSTAFF_PERSONAL_ACCESS_TOKEN (recommended) or HUBSTAFF_REFRESH_TOKEN to a Hubstaff refresh token.",
    );
  }

  let authOptions: HubstaffAuthOptions | undefined;
  const clientId = optionalEnv("HUBSTAFF_CLIENT_ID", env);
  const clientSecret = optionalEnv("HUBSTAFF_CLIENT_SECRET", env);

  if (personalAccessToken !== undefined) {
    if (clientId !== undefined || clientSecret !== undefined) {
      throw new Error(
        "Do not set HUBSTAFF_CLIENT_ID/HUBSTAFF_CLIENT_SECRET when using HUBSTAFF_PERSONAL_ACCESS_TOKEN.",
      );
    }
  } else {
    if (clientId !== undefined && clientSecret !== undefined) {
      authOptions = { clientId, clientSecret };
    } else if (clientId !== undefined || clientSecret !== undefined) {
      throw new Error("Set both HUBSTAFF_CLIENT_ID and HUBSTAFF_CLIENT_SECRET for OAuth refresh tokens.");
    }
  }

  const apiBaseUrl = optionalEnv("HUBSTAFF_API_BASE_URL", env);

  const auth = new HubstaffAuth(refreshToken, authOptions);
  const client = new HubstaffClient(auth, apiBaseUrl === undefined ? {} : { apiBaseUrl });

  return { auth, client };
}

/** Validates env without calling Hubstaff. */
export function assertHubstaffEnvConfigured(env: NodeJS.ProcessEnv = process.env): void {
  createHubstaffFromEnv(env);
}

function readVersionFromPackageJson(): string | undefined {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, "..", "package.json");
    const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: unknown };
    if (typeof parsed.version === "string") {
      const v = parsed.version.trim();
      if (v !== "") return v;
    }
  } catch {
    /* missing or invalid package.json */
  }
  return undefined;
}

/**
 * Semver from `package.json` next to the compiled `dist/` tree (Docker, `node dist/index.js`);
 * falls back to `npm_package_version` when npm runs the script, then `0.0.0`.
 */
export function getServerVersion(env: NodeJS.ProcessEnv = process.env): string {
  return readVersionFromPackageJson() ?? optionalEnv("npm_package_version", env) ?? "0.0.0";
}

export function shouldPrintVersion(argv: string[]): boolean {
  return argv.includes("--version") || argv.includes("-V");
}

/** When true, validates credentials and performs a single authenticated GET /users/me, then exits 0. */
export function shouldRunHealthCheck(argv: string[]): boolean {
  return argv.includes("--health");
}

export async function runHealthCheck(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const { client } = createHubstaffFromEnv(env);
  await client.getJson("users/me", undefined, fetchFn);
}
