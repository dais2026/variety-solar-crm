export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  smsBroadcastUsername: process.env.SMS_BROADCAST_USERNAME ?? "",
  smsBroadcastPassword: process.env.SMS_BROADCAST_PASSWORD ?? "",
  googleSheetsToken: process.env.GOOGLE_SHEETS_TOKEN ?? "",
  zohoImapHost: process.env.ZOHO_IMAP_HOST ?? "imappro.zoho.com",
  zohoImapUser: process.env.ZOHO_IMAP_USER ?? "",
  zohoImapPassword: process.env.ZOHO_IMAP_PASSWORD ?? "",
};

/**
 * Get the best available Google OAuth token for Sheets API access.
 * Priority order (first valid token wins):
 * 1. GOOGLE_DRIVE_TOKEN - auto-refreshed by the Manus Google Drive connector (most reliable)
 * 2. GOOGLE_WORKSPACE_CLI_TOKEN - sandbox-only, auto-refreshed by gws CLI
 * 3. GOOGLE_SHEETS_TOKEN - manually set, may expire
 *
 * A token is considered valid if it's longer than 100 characters.
 */
export function getGoogleToken(): string {
  const MIN_TOKEN_LENGTH = 100;

  // GOOGLE_DRIVE_TOKEN is auto-refreshed by the Manus platform Google Drive connector
  // This is the most reliable source as it stays valid as long as the connector is active
  const driveToken = process.env.GOOGLE_DRIVE_TOKEN ?? "";
  if (driveToken.length > MIN_TOKEN_LENGTH) return driveToken;

  // GOOGLE_WORKSPACE_CLI_TOKEN is used by the gws CLI - sandbox-only
  const workspaceToken = process.env.GOOGLE_WORKSPACE_CLI_TOKEN ?? "";
  if (workspaceToken.length > MIN_TOKEN_LENGTH) return workspaceToken;

  // GOOGLE_SHEETS_TOKEN is the manually configured secret (may be expired)
  const sheetsToken = ENV.googleSheetsToken;
  if (sheetsToken && sheetsToken.length > MIN_TOKEN_LENGTH) return sheetsToken;

  return "";
}
