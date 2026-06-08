/**
 * Standalone Google Sheets Integration - Replaces Manus Google API
 * 
 * Features:
 * - OAuth2 authentication
 * - Read/write Google Sheets
 * - Import leads from spreadsheets
 * - Export reports to Sheets
 */

import { google } from "googleapis";

// Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/google/callback";
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const GOOGLE_SHEETS_TOKEN = process.env.GOOGLE_SHEETS_TOKEN;

// Types
export interface SheetRow {
  [key: string]: string | number | null;
}

export interface SheetData {
  headers: string[];
  rows: SheetRow[];
}

export interface LeadImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// Initialize OAuth2 client
let oauth2Client: any = null;

function getOAuth2Client() {
  if (!oauth2Client && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );
  }
  return oauth2Client;
}

// Initialize Sheets client
let sheetsClient: any = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const auth = getOAuth2Client();
  if (!auth) return null;

  // Set credentials from stored token
  if (GOOGLE_SHEETS_TOKEN) {
    try {
      const credentials = JSON.parse(GOOGLE_SHEETS_TOKEN);
      auth.setCredentials(credentials);
    } catch (e) {
      console.error("[Google] Failed to parse stored token");
    }
  }

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

// Check if Google Sheets is configured
export function isConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

// Get OAuth authorization URL
export function getAuthUrl(): string {
  const auth = getOAuth2Client();
  if (!auth) {
    throw new Error("Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  }

  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  return auth.generateAuthurl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<any> {
  const auth = getOAuth2Client();
  if (!auth) {
    throw new Error("Google OAuth not configured");
  }

  const { tokens } = await auth.getToken(code);
  
  // Store these tokens in environment or database
  return tokens;
}

// Set credentials with refresh token
export function setRefreshToken(refreshToken: string): void {
  const auth = getOAuth2Client();
  if (auth) {
    auth.setCredentials({
      refresh_token: refreshToken,
      access_token: undefined, // Will be refreshed automatically
    });
  }
}

// Read data from a sheet
export async function readSheet(
  spreadsheetId: string,
  range: string = "A1:Z1000"
): Promise<SheetData> {
  const sheets = await getSheetsClient();
  if (!sheets) {
    throw new Error("Google Sheets not configured or not authenticated");
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = response.data.values || [];
    
    if (values.length === 0) {
      return { headers: [], rows: [] };
    }

    // First row is headers
    const headers = values[0].map(String);
    const rows = values.slice(1).map((row: any[]) => {
      const obj: SheetRow = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || null;
      });
      return obj;
    });

    return { headers, rows };
  } catch (error: any) {
    console.error("[Google Sheets] Read error:", error);
    throw new Error(`Failed to read sheet: ${error.message}`);
  }
}

// Write data to a sheet
export async function writeSheet(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  const sheets = await getSheetsClient();
  if (!sheets) {
    throw new Error("Google Sheets not configured or not authenticated");
  }

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      resource: { values },
    });
  } catch (error: any) {
    console.error("[Google Sheets] Write error:", error);
    throw new Error(`Failed to write to sheet: ${error.message}`);
  }
}

// Append rows to a sheet
export async function appendSheet(
  spreadsheetId: string,
  sheetName: string,
  values: any[][]
): Promise<void> {
  const sheets = await getSheetsClient();
  if (!sheets) {
    throw new Error("Google Sheets not configured or not authenticated");
  }

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: "RAW",
      resource: { values },
    });
  } catch (error: any) {
    console.error("[Google Sheets] Append error:", error);
    throw new Error(`Failed to append to sheet: ${error.message}`);
  }
}

// Import leads from default spreadsheet
export async function importLeadsFromSheet(): Promise<LeadImportResult> {
  if (!GOOGLE_SHEETS_ID) {
    throw new Error("GOOGLE_SHEETS_ID not configured");
  }

  const data = await readSheet(GOOGLE_SHEETS_ID);
  
  if (data.rows.length === 0) {
    return { imported: 0, skipped: 0, errors: ["No data found in spreadsheet"] };
  }

  const { createLead } = await import("../db");
  const result: LeadImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of data.rows) {
    try {
      // Map common column names to fields
      const firstName = row["First Name"] || row["first_name"] || row["FirstName"] || row["Name"]?.toString().split(" ")[0] || "";
      const lastName = row["Last Name"] || row["last_name"] || row["LastName"] || row["Name"]?.toString().split(" ").slice(1).join(" ") || "";
      const email = row["Email"] || row["email"] || row["Email Address"] || "";
      const phone = row["Phone"] || row["phone"] || row["Mobile"] || row["Phone Number"] || "";
      const address = row["Address"] || row["address"] || row["Street"] || "";
      const suburb = row["Suburb"] || row["suburb"] || row["City"] || "";
      const state = row["State"] || row["state"] || row["State/Territory"] || "";
      const postcode = row["Postcode"] || row["postcode"] || row["Zip"] || "";
      const source = row["Source"] || row["source"] || row["Lead Source"] || "";
      const notes = row["Notes"] || row["notes"] || row["Comments"] || "";

      if (!firstName && !lastName && !email && !phone) {
        result.skipped++;
        continue;
      }

      // Check if lead already exists by email
      const existingLeads = await getLeads();
      const exists = existingLeads.some(
        (lead: any) => email && lead.email === email
      );

      if (exists) {
        result.skipped++;
        continue;
      }

      // Create new lead
      await createLead({
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        suburb: suburb || undefined,
        state: state || undefined,
        postcode: postcode || undefined,
        source: source || undefined,
        notes: notes || undefined,
      });

      result.imported++;
    } catch (error: any) {
      result.errors.push(`Row error: ${error.message}`);
    }
  }

  return result;
}

// Export leads to sheet
export async function exportLeadsToSheet(leads: any[]): Promise<void> {
  if (!GOOGLE_SHEETS_ID) {
    throw new Error("GOOGLE_SHEETS_ID not configured");
  }

  const values = [
    ["ID", "First Name", "Last Name", "Email", "Phone", "Address", "Suburb", "State", "Postcode", "Status", "Source", "Created At"],
    ...leads.map((lead) => [
      lead.id,
      lead.first_name,
      lead.last_name,
      lead.email || "",
      lead.phone || "",
      lead.address || "",
      lead.suburb || "",
      lead.state || "",
      lead.postcode || "",
      lead.status,
      lead.source || "",
      lead.created_at,
    ]),
  ];

  await writeSheet(GOOGLE_SHEETS_ID, "A1:L" + (leads.length + 1), values);
}

// Get sheet metadata
export async function getSheetInfo(spreadsheetId: string): Promise<{
  title: string;
  sheets: { title: string; index: number }[];
}> {
  const sheets = await getSheetsClient();
  if (!sheets) {
    throw new Error("Google Sheets not configured");
  }

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });

    const spreadsheet = response.data;
    return {
      title: spreadsheet.properties?.title || "",
      sheets: (spreadsheet.sheets || []).map((sheet: any, index: number) => ({
        title: sheet.properties?.title || "",
        index,
      })),
    };
  } catch (error: any) {
    console.error("[Google Sheets] Get info error:", error);
    throw new Error(`Failed to get sheet info: ${error.message}`);
  }
}

// Create a new spreadsheet
export async function createSpreadsheet(title: string): Promise<string> {
  const sheets = await getSheetsClient();
  if (!sheets) {
    throw new Error("Google Sheets not configured");
  }

  try {
    const response = await sheets.spreadsheets.create({
      resource: {
        properties: { title },
      },
    });

    return response.data.spreadsheetId || "";
  } catch (error: any) {
    console.error("[Google Sheets] Create error:", error);
    throw new Error(`Failed to create spreadsheet: ${error.message}`);
  }
}

export default {
  isConfigured,
  getAuthUrl,
  exchangeCodeForTokens,
  setRefreshToken,
  readSheet,
  writeSheet,
  appendSheet,
  importLeadsFromSheet,
  exportLeadsToSheet,
  getSheetInfo,
  createSpreadsheet,
};