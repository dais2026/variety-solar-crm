import Imap from "imap";
import { simpleParser } from "mailparser";
import mysql from "mysql2/promise";

const user = process.env.ZOHO_IMAP_USER;
const password = process.env.ZOHO_IMAP_PASSWORD;
const host = process.env.ZOHO_IMAP_HOST || "imap.zoho.com.au";

// Names we're looking for
const MISSING_NAMES = ["Helen Waters", "Michael Furnell", "George Kazilieris", "Fabio Tercelli"];

function fetchEmails() {
  return new Promise((resolve, reject) => {
    const emails = [];
    const imap = new Imap({ user, password, host, port: 993, tls: true, tlsOptions: { rejectUnauthorized: false }, connTimeout: 30000, authTimeout: 15000 });

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) { imap.end(); reject(err); return; }

        imap.search([["SUBJECT", "SolarQuotes"]], (err, uids) => {
          if (err) { imap.end(); reject(err); return; }
          if (!uids || uids.length === 0) { imap.end(); resolve([]); return; }

          // Get the last 15 emails
          const recent = uids.slice(-15);
          const fetch = imap.fetch(recent, { bodies: "", struct: true });
          let pending = recent.length;

          fetch.on("message", (msg) => {
            let buffer = Buffer.alloc(0);
            msg.on("body", (stream) => {
              stream.on("data", (chunk) => { buffer = Buffer.concat([buffer, chunk]); });
            });
            msg.once("end", async () => {
              try {
                const parsed = await simpleParser(buffer);
                const subject = parsed.subject || "";
                const text = parsed.text || "";
                // Check if this email is for one of our missing leads
                const isTarget = MISSING_NAMES.some(name => subject.includes(name.split(" ").pop()));
                if (isTarget) {
                  emails.push({ subject, text, date: parsed.date?.toISOString() || "" });
                }
              } catch (e) {}
              pending--;
              if (pending === 0) { imap.end(); resolve(emails); }
            });
          });

          fetch.once("error", (err) => { imap.end(); reject(err); });
        });
      });
    });

    imap.once("error", reject);
    imap.connect();
  });
}

async function main() {
  console.log("Fetching emails from IMAP...");
  const emails = await fetchEmails();
  console.log(`Found ${emails.length} matching emails for missing leads`);

  for (const email of emails) {
    console.log("\n=== EMAIL ===");
    console.log("Subject:", email.subject);
    console.log("Date:", email.date);
    console.log("Body (first 2000 chars):");
    console.log(email.text.substring(0, 2000));
    console.log("=== END ===\n");
  }

  // Also check what's already in the DB
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query("SELECT leadRef, leadName, leadPhone, leadAddress FROM solar_quotes_imports ORDER BY importedAt DESC LIMIT 15");
  console.log("\n=== DB Records (last 15) ===");
  for (const r of rows) {
    console.log(`${r.leadRef} | ${r.leadName} | ${r.leadPhone} | ${r.leadAddress}`);
  }
  await conn.end();
}

main().catch(console.error);
