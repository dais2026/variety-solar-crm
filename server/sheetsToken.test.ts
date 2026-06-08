import { describe, it, expect } from "vitest";
import { getGoogleToken } from "./_core/env";

describe("Google Sheets token (centralized getGoogleToken)", () => {
  const SPREADSHEET_ID = "1oVFGomjgmbYlX7YJUFWKH0-1snrjCkcBsUC6AW4rmgA";
  const SHEET_NAME = "LEADS MAY26";

  it("getGoogleToken should return a valid token from the fallback chain", () => {
    const token = getGoogleToken();
    // In the sandbox environment, GOOGLE_DRIVE_TOKEN or GOOGLE_WORKSPACE_CLI_TOKEN should be available
    // In production, GOOGLE_DRIVE_TOKEN is auto-refreshed by the Manus Google Drive connector
    expect(token.length).toBeGreaterThan(100);
  });

  it("should be able to read from Google Sheets API with the resolved token", async () => {
    const token = getGoogleToken();
    if (!token) {
      console.warn("No Google token available, skipping API test");
      return;
    }

    const range = encodeURIComponent(`${SHEET_NAME}!A1:B1`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.values).toBeDefined();
    expect(data.values[0][0]).toBe("DATE STAMP");
  });
});
