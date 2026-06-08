import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getGoogleToken } from "../_core/env";
import { TRPCError } from "@trpc/server";
import { insertDeletedLead, getDeletedLeads, removeDeletedLead } from "../db";

const SPREADSHEET_ID = "1oVFGomjgmbYlX7YJUFWKH0-1snrjCkcBsUC6AW4rmgA";
const SHEET_NAME = "LEADS MAY26";

/**
 * Parse CSV text properly, handling quoted fields with newlines, commas, and escaped quotes.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = "";
        i++;
      } else if (char === '\r') {
        // Skip \r, handle \r\n as single newline
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Don't forget the last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Fetch leads from the Google Sheet using the public CSV export URL.
 * This does NOT require authentication and works permanently in production.
 */
async function fetchSheetCSV(): Promise<string[][]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=0`;

  const response = await fetch(csvUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    console.error("Google Sheets CSV export error:", response.status);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to fetch CSV from Google Sheets: ${response.status}`,
    });
  }

  const text = await response.text();
  return parseCSV(text);
}

/**
 * Fetch rows from the Google Sheet using the Sheets API v4 (requires auth token).
 * Used for write operations and as fallback for reads.
 */
async function fetchSheetValues(range: string): Promise<string[][]> {
  const token = getGoogleToken();
  if (!token) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "No valid Google token available for Sheets API access",
    });
  }

  const encodedRange = encodeURIComponent(`${SHEET_NAME}!${range}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google Sheets API error (read):", response.status, errorText);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to fetch from Google Sheets: ${response.status}`,
    });
  }

  const data = await response.json();
  return data.values || [];
}

async function appendRowToSheet(values: string[][]): Promise<{ updatedRange: string; updatedRows: number }> {
  const token = getGoogleToken();
  if (!token) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Google Sheets token not configured",
    });
  }

  const range = encodeURIComponent(`${SHEET_NAME}!A:Y`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Google Sheets API error:", response.status, error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to append to Google Sheets: ${response.status}`,
    });
  }

  const data = await response.json();
  return {
    updatedRange: data.updates?.updatedRange || "",
    updatedRows: data.updates?.updatedRows || 0,
  };
}



export const sheetsRouter = router({
  /**
   * Fetch all leads from the Google Sheet via public CSV export.
   * This approach requires NO authentication token and works permanently.
   */
  getLeads: publicProcedure.query(async () => {
    const values = await fetchSheetCSV();

    if (values.length < 2) {
      return { leads: [], headers: [] };
    }

    // First row is the header
    const headers = values[0];

    // Parse remaining rows into lead objects
    const leads = values
      .slice(1)
      .filter((row) => {
        // Skip empty rows or rows without a name
        return row.length > 1 && row[1] && row[1].trim() !== "";
      })
      .map((row) => {
        const cleanValue = (val: string | undefined) => {
          if (!val) return "";
          const v = val.trim();
          if (v === "--------" || v === "------" || v === "-------") return "";
          return v;
        };

        return {
          dateStamp: cleanValue(row[0]),
          name: cleanValue(row[1]),
          contactNumber: cleanValue(row[2]),
          email: cleanValue(row[3]),
          address: cleanValue(row[4]),
          leadSource: cleanValue(row[5]),
          product: cleanValue(row[6]),
          outcome: cleanValue(row[7]),
          status: cleanValue(row[8]),
          saleStatus: cleanValue(row[9]),
          notes: cleanValue(row[10]),
          costs: cleanValue(row[11]),
          svr: cleanValue(row[12]),
          phases: cleanValue(row[13]),
          rooftopSolar: cleanValue(row[14]),
          hotWater: cleanValue(row[15]),
          heatingCooling: cleanValue(row[16]),
          cooktop: cleanValue(row[17]),
          product2: cleanValue(row[18]),
          vppNightUse: cleanValue(row[19]),
          ev: cleanValue(row[20]),
          brands: cleanValue(row[21]),
          size: cleanValue(row[22]),
        };
      });

    return { leads, headers };
  }),

  deleteLead: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        contactNumber: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await insertDeletedLead({
        leadName: input.name,
        leadPhone: input.contactNumber,
        deletedAt: Date.now(),
      });
      return { success: true };
    }),

  getDeletedLeads: publicProcedure
    .query(async () => {
      return getDeletedLeads();
    }),

  restoreLead: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        contactNumber: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await removeDeletedLead(input.name, input.contactNumber);
      return { success: true };
    }),

  appendCustomer: publicProcedure
    .input(
      z.object({
        dateStamp: z.string(),
        name: z.string().min(1),
        contactNumber: z.string(),
        email: z.string(),
        address: z.string(),
        outcome: z.string(),
        leadSource: z.string(),
        status: z.string(),
        product: z.string(),
        saleStatus: z.string(),
        notes: z.string(),
        costs: z.string().optional().default(""),
        svr: z.string(),
        phases: z.string(),
        rooftopSolar: z.string(),
        hotWater: z.string(),
        heatingCooling: z.string(),
        cooktop: z.string(),
        product2: z.string().optional().default(""),
        vppNightUse: z.string(),
        ev: z.string(),
        brands: z.string(),
        size: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Map fields to columns A-W in the exact order of the sheet headers:
      const row = [
        input.dateStamp,
        input.name,
        input.contactNumber,
        input.email,
        input.address,
        input.leadSource,
        input.product,
        input.outcome,
        input.status,
        input.saleStatus,
        input.notes,
        input.costs,
        input.svr,
        input.phases,
        input.rooftopSolar,
        input.hotWater,
        input.heatingCooling,
        input.cooktop,
        input.product2,
        input.vppNightUse,
        input.ev,
        input.brands,
        input.size,
      ];

      const result = await appendRowToSheet([row]);
      return {
        success: true,
        updatedRange: result.updatedRange,
        updatedRows: result.updatedRows,
      };
    }),
});
