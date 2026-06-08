import type { Request, Response } from "express";
import Imap from "imap";
import { simpleParser } from "mailparser";
import { ENV, getGoogleToken } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getSolarQuotesImportByRef, insertSolarQuotesImport, insertLeadTranscript, markSheetWritten, incrementSheetRetries, getUnwrittenLeads } from "./db";
import { notifyOwner } from "./_core/notification";
import { parseLeadEmail, getSearchSubjects } from "./leadParsers";

/**
 * Parse Solar Quotes lead email body to extract structured lead data.
 * Handles both plain text and the CSV attachment format.
 */
function parseSolarQuotesEmail(text: string): {
  leadRef: string;
  source: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  product: string;
  notes: string;
  date: string;
} | null {
  const leadRefMatch = text.match(/Lead Ref:\s*(\d+)/i);
  if (!leadRefMatch) return null;

  const leadRef = leadRefMatch[1];

  // Extract name
  const nameMatch = text.match(/Name:\s*(.+?)(?:\s*\n|$)/i);
  const fullName = nameMatch ? nameMatch[1].trim() : "";
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Extract email
  const emailMatch = text.match(/Email:\s*(?:mailto:)?(\S+@\S+)/i);
  const emailAddr = emailMatch ? emailMatch[1].trim() : "";

  // Extract phone
  const phoneMatch = text.match(/Phone:\s*([\d\s]+)/i);
  const phone = phoneMatch ? phoneMatch[1].trim().replace(/\s+/g, "") : "";

  // Extract address
  const addressMatch = text.match(/Installation address:[\s\S]*?(.+?)(?:\n.*?(?:VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\s+\d{4})/i);
  let address = "";
  let city = "";
  let state = "";
  let postcode = "";

  // Try to extract full address block
  const fullAddressMatch = text.match(/Installation address:\s*([\s\S]+?)(?=\s*(?:Australia|Name:|$))/i);
  if (fullAddressMatch) {
    const addrBlock = fullAddressMatch[1].trim();
    const lines = addrBlock.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      address = lines[0];
      // Parse city/state/postcode from second line
      const cityStateMatch = lines[1].match(/^(.+?)\s+(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})/i);
      if (cityStateMatch) {
        city = cityStateMatch[1].trim();
        state = cityStateMatch[2].toUpperCase();
        postcode = cityStateMatch[3];
      } else {
        city = lines[1];
      }
    } else if (lines.length === 1) {
      address = lines[0];
    }
  }

  // Extract features/products
  const featuresMatch = text.match(/Features:\s*\n([\s\S]*?)(?=\nInstallation address|\nName:)/i);
  let product = "";
  if (featuresMatch) {
    const features = featuresMatch[1]
      .split("\n")
      .map(f => f.trim())
      .filter(f => f && !f.startsWith("-"));
    product = features.join(", ");
  } else {
    // Try simpler extraction
    const simpleFeatures = text.match(/Features:\s*\n?((?:.*\n)*?)(?=Installation|Name:)/i);
    if (simpleFeatures) {
      product = simpleFeatures[1]
        .split("\n")
        .map(f => f.replace(/^[-•]\s*/, "").trim())
        .filter(Boolean)
        .join(", ");
    }
  }

  // Extract special instructions/notes
  const notesMatch = text.match(/Special instructions from \w+:\s*([\s\S]+?)(?=\s*This lead was submitted|$)/i);
  const notes = notesMatch ? notesMatch[1].trim() : "";

  // Extract date
  const dateMatch = text.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);
  let date = "";
  if (dateMatch) {
    // Convert from 2026-06-03 to DD.MM.YY format
    const [year, month, day] = dateMatch[1].split("-");
    date = `${day}.${month}.${year.slice(2)}`;
  }

  // Extract quarterly bill for notes enrichment
  const billMatch = text.match(/Quarterly Bill:\s*(.+?)(?:\n|$)/i);
  const bill = billMatch ? billMatch[1].trim() : "";

  // Extract system size
  const sizeMatch = text.match(/System Size:\s*(.+?)(?:\n|$)/i);
  const systemSize = sizeMatch ? sizeMatch[1].trim() : "";

  // Build enriched notes
  let enrichedNotes = notes;
  if (bill) enrichedNotes += enrichedNotes ? ` | Bill: ${bill}` : `Bill: ${bill}`;
  if (systemSize && systemSize !== "Not Sure. Please help me decide") {
    enrichedNotes += ` | Size: ${systemSize}`;
  }

  return {
    leadRef,
    source: "Solar Quotes",
    name: fullName,
    firstName,
    lastName,
    email: emailAddr,
    phone,
    address: address ? `${address}, ${city} ${state} ${postcode}`.trim() : "",
    city,
    state,
    postcode,
    product,
    notes: enrichedNotes,
    date,
  };
}

/**
 * Folders to scan for lead emails.
 */
const IMAP_FOLDERS = ["INBOX", "INBOX/Sales", "Sales"];

/**
 * Connect to Zoho IMAP and fetch unprocessed Solar Quotes emails from multiple folders.
 */
async function fetchSolarQuotesEmails(): Promise<
  Array<{ uid: string; text: string; subject: string; date: string }>
> {
  const { zohoImapHost, zohoImapUser, zohoImapPassword } = ENV;

  if (!zohoImapUser || !zohoImapPassword) {
    throw new Error("IMAP credentials not configured");
  }

  const allEmails: Array<{ uid: string; text: string; subject: string; date: string }> = [];

  for (const folder of IMAP_FOLDERS) {
    try {
      const folderEmails = await fetchFromFolder(folder, zohoImapUser, zohoImapPassword, zohoImapHost);
      allEmails.push(...folderEmails);
    } catch (err) {
      // Folder might not exist — skip silently
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!errMsg.includes("Mailbox does not exist") && !errMsg.includes("NO")) {
        console.error(`[SolarQuotes] Error scanning folder ${folder}:`, errMsg);
      }
    }
  }

  // Deduplicate by uid (in case same email appears in multiple folders)
  const seen = new Set<string>();
  return allEmails.filter(e => {
    if (seen.has(e.uid)) return false;
    seen.add(e.uid);
    return true;
  });
}

/**
 * Fetch lead emails from a single IMAP folder.
 */
function fetchFromFolder(
  folder: string,
  user: string,
  password: string,
  host: string
): Promise<Array<{ uid: string; text: string; subject: string; date: string }>> {
  return new Promise((resolve, reject) => {
    const emails: Array<{ uid: string; text: string; subject: string; date: string }> = [];

    const imap = new Imap({
      user,
      password,
      host,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000,
      authTimeout: 15000,
    });

    imap.once("ready", () => {
      imap.openBox(folder, true, (err) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        // Search for emails from all registered lead sources
        const subjects = getSearchSubjects();
        // IMAP OR only accepts exactly 2 criteria; nest for 3+
        let searchCriteria: any[];
        if (subjects.length === 0) {
          imap.end();
          resolve([]);
          return;
        } else if (subjects.length === 1) {
          searchCriteria = [["SUBJECT", subjects[0]]];
        } else if (subjects.length === 2) {
          searchCriteria = [["OR", ["SUBJECT", subjects[0]], ["SUBJECT", subjects[1]]]];
        } else {
          // Build nested OR: OR(s[0], OR(s[1], OR(s[2], ...)))
          let nested: any = ["SUBJECT", subjects[subjects.length - 1]];
          for (let i = subjects.length - 2; i >= 0; i--) {
            nested = ["OR", ["SUBJECT", subjects[i]], nested];
          }
          searchCriteria = [nested];
        }
        imap.search(searchCriteria, (err, uids) => {
          if (err) {
            imap.end();
            reject(err);
            return;
          }

          if (!uids || uids.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          // Only process the most recent 20 per folder to avoid timeout
          const recentUids = uids.slice(-20);

          const fetch = imap.fetch(recentUids, {
            bodies: "",
            struct: true,
          });

          let pending = recentUids.length;

          fetch.on("message", (msg, seqno) => {
            let buffer = Buffer.alloc(0);
            let uid = "";

            msg.on("attributes", (attrs) => {
              uid = `${folder}:${String(attrs.uid)}`;
            });

            msg.on("body", (stream) => {
              const chunks: Buffer[] = [];
              stream.on("data", (chunk: Buffer) => {
                chunks.push(chunk);
              });
              stream.on("end", () => {
                buffer = Buffer.concat(chunks);
              });
            });

            msg.on("end", async () => {
              try {
                const parsed = await simpleParser(buffer);
                const text = parsed.text || "";
                const subject = parsed.subject || "";
                const date = parsed.date?.toISOString() || "";

                emails.push({ uid, text, subject, date });
              } catch (e) {
                console.error(`[SolarQuotes] Error parsing email in ${folder}:`, e);
              }

              pending--;
              if (pending === 0) {
                imap.end();
                resolve(emails);
              }
            });
          });

          fetch.once("error", (err) => {
            imap.end();
            reject(err);
          });

          fetch.once("end", () => {
            if (pending === 0) {
              imap.end();
              resolve(emails);
            }
          });
        });
      });
    });

    imap.once("error", (err: Error) => {
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Append a lead row to Google Sheets via the Sheets API.
 */
const MAX_SHEET_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 5000, 10000]; // 2s, 5s, 10s backoff

async function appendLeadToSheet(lead: {
  date: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  source: string;
  product: string;
  notes: string;
  leadRef?: string;
}): Promise<boolean> {
  const SPREADSHEET_ID = "1oVFGomjgmbYlX7YJUFWKH0-1snrjCkcBsUC6AW4rmgA";
  const SHEET_NAME = "LEADS MAY26";

  // Build the row in the exact column order:
  // A: Date Stamp, B: Name, C: Contact Number, D: Email, E: Address,
  // F: Lead Source, G: Product, H: Discovery/Outcome, I: Status, J: Sale Status, K: Notes
  const row = [
    lead.date,           // A: DATE STAMP
    lead.name,           // B: Name
    lead.phone,          // C: Contact Number
    lead.email,          // D: Email Address
    lead.address,        // E: Address
    lead.source || "Solar Quotes",      // F: Lead Source
    lead.product,        // G: Product
    "Awaiting Information", // H: Discovery/Outcome
    "Pending",           // I: Status
    "",                  // J: Sale Status
    lead.notes,          // K: Notes
  ];

  const range = encodeURIComponent(`${SHEET_NAME}!A:K`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  for (let attempt = 0; attempt < MAX_SHEET_RETRIES; attempt++) {
    // Get fresh token on each attempt (in case it was refreshed between retries)
    const token = getGoogleToken();
    if (!token) {
      console.error(`[SolarQuotes] No Google token available (attempt ${attempt + 1}/${MAX_SHEET_RETRIES})`);
      if (lead.leadRef) {
        await incrementSheetRetries(lead.leadRef);
      }
      if (attempt < MAX_SHEET_RETRIES - 1) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      // Fall through to the notification block below
      break;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [row] }),
      });

      if (response.ok) {
        // Mark as written in DB
        if (lead.leadRef) {
          await markSheetWritten(lead.leadRef);
        }
        return true;
      }

      const error = await response.text();
      console.error(`[SolarQuotes] Sheets API error (attempt ${attempt + 1}/${MAX_SHEET_RETRIES}):`, response.status, error);

      // Track retry attempt in DB
      if (lead.leadRef) {
        await incrementSheetRetries(lead.leadRef);
      }

      // Don't retry on 4xx client errors (except 401/429)
      if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 429) {
        break;
      }
    } catch (fetchErr) {
      console.error(`[SolarQuotes] Sheets fetch error (attempt ${attempt + 1}/${MAX_SHEET_RETRIES}):`, fetchErr);
      if (lead.leadRef) {
        await incrementSheetRetries(lead.leadRef);
      }
    }

    // Wait before retrying
    if (attempt < MAX_SHEET_RETRIES - 1) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  // All retries exhausted — notify owner
  console.error(`[SolarQuotes] FAILED to write ${lead.name} to Google Sheet after ${MAX_SHEET_RETRIES} attempts`);
  try {
    await notifyOwner({
      title: `⚠️ Sheet Write Failed: ${lead.name}`,
      content: `Lead "${lead.name}" (ref: ${lead.leadRef || "unknown"}) was saved to the CRM database but FAILED to write to the Google Sheet after ${MAX_SHEET_RETRIES} retry attempts. The lead will be retried on the next reconciliation cycle. Please check the Google Sheets token.`,
    });
  } catch (notifyErr) {
    console.error("[SolarQuotes] Failed to send owner notification:", notifyErr);
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Express handler for the scheduled Solar Quotes import heartbeat.
 * Runs every 15 minutes to check for new Solar Quotes lead emails.
 */
export async function scheduledSolarQuotesHandler(req: Request, res: Response): Promise<void> {
  try {
    // Authenticate - must be a cron request
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }

    console.log("[SolarQuotes] Heartbeat triggered, taskUid:", user.taskUid);

    // Fetch Solar Quotes emails from IMAP
    let emails;
    try {
      emails = await fetchSolarQuotesEmails();
    } catch (imapErr) {
      const errMsg = imapErr instanceof Error ? imapErr.message : String(imapErr);
      console.error("[SolarQuotes] IMAP error:", errMsg);
      res.status(500).json({
        error: `IMAP connection failed: ${errMsg}`,
        context: { url: req.url, taskUid: user.taskUid },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    console.log(`[SolarQuotes] Found ${emails.length} Solar Quotes emails in inbox`);

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const emailData of emails) {
      try {
        // Try multi-source parser first, fall back to legacy Solar Quotes parser
        const lead = parseLeadEmail(emailData.text, emailData.subject) || parseSolarQuotesEmail(emailData.text);
        if (!lead || !lead.leadRef) {
          continue; // Not a valid lead email from any known source
        }

        // Check if already imported (dedupe by lead reference number)
        const existing = await getSolarQuotesImportByRef(lead.leadRef);
        if (existing) {
          skippedCount++;
          continue;
        }

        // Track as imported to prevent duplicates (save to DB first, Sheet write is best-effort)
        await insertSolarQuotesImport({
          leadRef: lead.leadRef,
          leadName: lead.name,
          leadEmail: lead.email,
          leadPhone: lead.phone,
          leadAddress: lead.address || null,
          leadSource: lead.source || "Solar Quotes",
          notes: lead.notes || null,
          leadDate: lead.date || null,
          leadProduct: lead.product || null,
          emailUid: emailData.uid,
          importedAt: Date.now(),
        });

        // Store full transcript for the lead detail dropdown
        try {
          await insertLeadTranscript({
            leadName: lead.name,
            leadEmail: lead.email,
            leadPhone: lead.phone,
            leadAddress: lead.address || null,
            leadSource: lead.source || "Solar Quotes",
            leadRef: lead.leadRef,
            fullTranscript: emailData.text,
            summary: `Interest: ${lead.product}. ${lead.notes}`.slice(0, 500),
            leadDate: emailData.date || lead.date,
            createdAt: Date.now(),
          });
        } catch (transcriptErr) {
          console.error(`[SolarQuotes] Failed to store transcript for ${lead.name}:`, transcriptErr);
        }

        // Append to Google Sheet with retry logic (lead is already saved to DB)
        const sheetSuccess = await appendLeadToSheet({
          date: lead.date,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          source: lead.source || "Solar Quotes",
          product: lead.product,
          notes: lead.notes,
          leadRef: lead.leadRef,
        });
        if (!sheetSuccess) {
          errors.push(`Failed to write ${lead.name} (ref ${lead.leadRef}) to Google Sheets after ${MAX_SHEET_RETRIES} retries (lead saved to CRM)`);
        }

        importedCount++;
        console.log(`[SolarQuotes] Imported lead: ${lead.name} (ref ${lead.leadRef})`);
        console.log(`[SolarQuotes] Stored transcript for: ${lead.name}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Error processing email: ${errMsg}`);
      }
    }

    // Reconciliation: retry any previously failed sheet writes
    let reconciliation: { attempted: number; succeeded: number; failed: number } | undefined;
    try {
      reconciliation = await reconcileUnwrittenLeads();
      if (reconciliation.attempted > 0) {
        console.log(`[SolarQuotes] Reconciliation: ${reconciliation.succeeded}/${reconciliation.attempted} recovered`);
      }
    } catch (reconErr) {
      console.error("[SolarQuotes] Reconciliation error:", reconErr);
    }

    const response = {
      ok: true,
      totalEmails: emails.length,
      imported: importedCount,
      skipped: skippedCount,
      reconciliation: reconciliation?.attempted ? reconciliation : undefined,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log("[SolarQuotes] Heartbeat complete:", response);
    res.json(response);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[SolarQuotes] Handler error:", error);
    res.status(500).json({
      error,
      stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Core import logic extracted for reuse by both scheduled and manual triggers.
 */
export async function runSolarQuotesImport(): Promise<{
  ok: boolean;
  totalEmails: number;
  imported: number;
  skipped: number;
  errors?: string[];
}> {
  const emails = await fetchSolarQuotesEmails();

  let importedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const emailData of emails) {
    try {
      const lead = parseLeadEmail(emailData.text, emailData.subject) || parseSolarQuotesEmail(emailData.text);
      if (!lead || !lead.leadRef) continue;

      const existing = await getSolarQuotesImportByRef(lead.leadRef);
      if (existing) {
        skippedCount++;
        continue;
      }

      // Save to DB first (Sheet write is best-effort)
      await insertSolarQuotesImport({
        leadRef: lead.leadRef,
        leadName: lead.name,
        leadEmail: lead.email,
        leadPhone: lead.phone,
        leadAddress: lead.address || null,
        leadSource: lead.source || "Solar Quotes",
        notes: lead.notes || null,
        leadDate: lead.date || null,
        leadProduct: lead.product || null,
        emailUid: emailData.uid,
        importedAt: Date.now(),
      });

      try {
        await insertLeadTranscript({
          leadName: lead.name,
          leadEmail: lead.email,
          leadPhone: lead.phone,
          leadAddress: lead.address || null,
          leadSource: lead.source || "Solar Quotes",
          leadRef: lead.leadRef,
          fullTranscript: emailData.text,
          summary: `Interest: ${lead.product}. ${lead.notes}`.slice(0, 500),
          leadDate: emailData.date || lead.date,
          createdAt: Date.now(),
        });
      } catch (transcriptErr) {
        console.error(`[SolarQuotes] Failed to store transcript for ${lead.name}:`, transcriptErr);
      }

      // Append to Google Sheet with retry logic
      const sheetSuccess = await appendLeadToSheet({
        date: lead.date,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        source: lead.source || "Solar Quotes",
        product: lead.product,
        notes: lead.notes,
        leadRef: lead.leadRef,
      });
      if (!sheetSuccess) {
        errors.push(`Failed to write ${lead.name} (ref ${lead.leadRef}) to Google Sheets after ${MAX_SHEET_RETRIES} retries (lead saved to CRM)`);
      }

      importedCount++;
      console.log(`[SolarQuotes] Imported lead: ${lead.name} (ref ${lead.leadRef})`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Error processing email: ${errMsg}`);
    }
  }

  return {
    ok: true,
    totalEmails: emails.length,
    imported: importedCount,
    skipped: skippedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Reconciliation: retry writing any leads that are in the DB but not yet in the Google Sheet.
 * Called by the heartbeat on each cycle to self-heal any failed writes.
 */
export async function reconcileUnwrittenLeads(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const unwritten = await getUnwrittenLeads();
  if (unwritten.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  console.log(`[SolarQuotes] Reconciliation: found ${unwritten.length} leads not yet written to sheet`);

  let succeeded = 0;
  let failed = 0;

  for (const lead of unwritten) {
    // Use stored leadDate if available, otherwise derive from importedAt
    let dateStr = lead.leadDate || "";
    if (!dateStr) {
      const d = new Date(lead.importedAt);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).slice(-2);
      dateStr = `${day}.${month}.${year}`;
    }

    const success = await appendLeadToSheet({
      date: dateStr,
      name: lead.leadName,
      phone: lead.leadPhone || "",
      email: lead.leadEmail || "",
      address: lead.leadAddress || "",
      source: lead.leadSource || "Solar Quotes",
      product: lead.leadProduct || "",
      notes: lead.notes || "",
      leadRef: lead.leadRef,
    });

    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  if (succeeded > 0) {
    console.log(`[SolarQuotes] Reconciliation: successfully wrote ${succeeded}/${unwritten.length} leads to sheet`);
  }
  if (failed > 0) {
    console.log(`[SolarQuotes] Reconciliation: ${failed}/${unwritten.length} leads still failed`);
  }

  return { attempted: unwritten.length, succeeded, failed };
}
