/**
 * Multi-source email lead parser framework.
 * 
 * Each lead source (Solar Quotes, Energy Matters, One Flare, etc.) has a parser
 * that detects whether an email matches its format and extracts structured lead data.
 * 
 * To add a new lead source:
 * 1. Create a parser function that implements LeadParser
 * 2. Register it in the LEAD_PARSERS array below
 * 3. The scheduled handler will automatically try each parser in order
 */

export interface ParsedLead {
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
}

export interface LeadParser {
  /** Unique identifier for this lead source */
  sourceId: string;
  /** Human-readable name shown in the CRM */
  sourceName: string;
  /** IMAP search criteria to find emails from this source */
  searchSubject: string;
  /** Check if an email body matches this lead source format */
  canParse(text: string, subject: string): boolean;
  /** Parse the email body into structured lead data */
  parse(text: string): ParsedLead | null;
}

// ─── Solar Quotes Parser ──────────────────────────────────────────────────────

const solarQuotesParser: LeadParser = {
  sourceId: "solar-quotes",
  sourceName: "Solar Quotes",
  searchSubject: "SolarQuotes",

  canParse(text: string, subject: string): boolean {
    return (
      subject.toLowerCase().includes("solarquotes") ||
      text.includes("Lead Ref:") && text.includes("SolarQuotes")
    );
  },

  parse(text: string): ParsedLead | null {
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
    let address = "";
    let city = "";
    let state = "";
    let postcode = "";

    const fullAddressMatch = text.match(/Installation address:\s*([\s\S]+?)(?=\s*(?:Australia|Name:|$))/i);
    if (fullAddressMatch) {
      const addrBlock = fullAddressMatch[1].trim();
      const lines = addrBlock.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        address = lines[0];
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
      const [, isoDate] = dateMatch;
      const parts = isoDate.split("-");
      date = `${parts[2]}.${parts[1]}.${parts[0].slice(2)}`;
    } else {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, "0");
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const y = String(now.getFullYear()).slice(2);
      date = `${d}.${m}.${y}`;
    }

    // Enrich notes with additional info
    let enrichedNotes = notes;
    const billMatch = text.match(/quarterly.*?bill.*?\$?([\d,]+)/i);
    if (billMatch) {
      enrichedNotes += ` | Quarterly bill: $${billMatch[1]}`;
    }
    const sizeMatch = text.match(/system size.*?(\d+\.?\d*)\s*kW/i);
    if (sizeMatch) {
      enrichedNotes += ` | System size: ${sizeMatch[1]}kW`;
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
  },
};

// ─── Energy Matters Parser ────────────────────────────────────────────────────

const energyMattersParser: LeadParser = {
  sourceId: "energy-matters",
  sourceName: "Energy Matters",
  searchSubject: "Energy Matters",

  canParse(text: string, subject: string): boolean {
    return (
      subject.toLowerCase().includes("energy matters") ||
      (text.includes("Energy Matters") && text.includes("lead"))
    );
  },

  parse(text: string): ParsedLead | null {
    // Energy Matters typically sends leads with a reference number
    const refMatch = text.match(/(?:Reference|Ref|ID)[:#\s]*(\w+)/i);
    if (!refMatch) return null;

    const leadRef = `EM-${refMatch[1]}`;

    const nameMatch = text.match(/(?:Customer|Name|Client):\s*(.+?)(?:\s*\n|$)/i);
    const fullName = nameMatch ? nameMatch[1].trim() : "";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const emailMatch = text.match(/(?:Email|E-mail):\s*(\S+@\S+)/i);
    const email = emailMatch ? emailMatch[1].trim() : "";

    const phoneMatch = text.match(/(?:Phone|Mobile|Contact):\s*([\d\s()+]+)/i);
    const phone = phoneMatch ? phoneMatch[1].trim().replace(/[\s()+-]/g, "") : "";

    const addressMatch = text.match(/(?:Address|Location):\s*(.+?)(?:\s*\n|$)/i);
    const address = addressMatch ? addressMatch[1].trim() : "";

    // Try to extract state/postcode from address
    let city = "";
    let state = "";
    let postcode = "";
    const stateMatch = address.match(/(.+?)\s+(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})/i);
    if (stateMatch) {
      city = stateMatch[1].split(",").pop()?.trim() || "";
      state = stateMatch[2].toUpperCase();
      postcode = stateMatch[3];
    }

    const productMatch = text.match(/(?:Interest|Product|System|Service):\s*(.+?)(?:\s*\n|$)/i);
    const product = productMatch ? productMatch[1].trim() : "Solar";

    const notesMatch = text.match(/(?:Notes|Comments|Message):\s*([\s\S]+?)(?=\s*(?:---|\*\*|$))/i);
    const notes = notesMatch ? notesMatch[1].trim() : "";

    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = String(now.getFullYear()).slice(2);
    const date = `${d}.${m}.${y}`;

    return {
      leadRef,
      source: "Energy Matters",
      name: fullName,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      state,
      postcode,
      product,
      notes,
      date,
    };
  },
};

// ─── One Flare Parser ─────────────────────────────────────────────────────────

const oneFlareParser: LeadParser = {
  sourceId: "one-flare",
  sourceName: "One Flare",
  searchSubject: "Oneflare",

  canParse(text: string, subject: string): boolean {
    return (
      subject.toLowerCase().includes("oneflare") ||
      text.toLowerCase().includes("oneflare")
    );
  },

  parse(text: string): ParsedLead | null {
    const refMatch = text.match(/(?:Job|Quote|Request)\s*(?:#|ID|Ref)?:?\s*(\d+)/i);
    if (!refMatch) return null;

    const leadRef = `OF-${refMatch[1]}`;

    const nameMatch = text.match(/(?:Customer|Name|From|Posted by):\s*(.+?)(?:\s*\n|$)/i);
    const fullName = nameMatch ? nameMatch[1].trim() : "";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const emailMatch = text.match(/(?:Email|E-mail):\s*(\S+@\S+)/i);
    const email = emailMatch ? emailMatch[1].trim() : "";

    const phoneMatch = text.match(/(?:Phone|Mobile|Contact):\s*([\d\s()+]+)/i);
    const phone = phoneMatch ? phoneMatch[1].trim().replace(/[\s()+-]/g, "") : "";

    const addressMatch = text.match(/(?:Location|Suburb|Address):\s*(.+?)(?:\s*\n|$)/i);
    const address = addressMatch ? addressMatch[1].trim() : "";

    let city = "";
    let state = "";
    let postcode = "";
    const stateMatch = address.match(/(.+?)\s+(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\s*(\d{4})?/i);
    if (stateMatch) {
      city = stateMatch[1].trim();
      state = stateMatch[2].toUpperCase();
      postcode = stateMatch[3] || "";
    } else {
      city = address;
    }

    const descMatch = text.match(/(?:Description|Details|Job details|Requirements):\s*([\s\S]+?)(?=\s*(?:Budget|---|\*\*|$))/i);
    const notes = descMatch ? descMatch[1].trim() : "";

    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = String(now.getFullYear()).slice(2);
    const date = `${d}.${m}.${y}`;

    return {
      leadRef,
      source: "One Flare",
      name: fullName,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      state,
      postcode,
      product: "Solar",
      notes,
      date,
    };
  },
};

// ─── Generic Lead Email Parser (fallback) ─────────────────────────────────────

const genericLeadParser: LeadParser = {
  sourceId: "generic",
  sourceName: "Email Lead",
  searchSubject: "",

  canParse(text: string, subject: string): boolean {
    // Fallback: try to detect any lead-like email with name + phone/email
    const hasName = /(?:Name|Customer|Client):\s*.+/i.test(text);
    const hasContact = /(?:Phone|Mobile|Email|Contact):\s*.+/i.test(text);
    return hasName && hasContact;
  },

  parse(text: string): ParsedLead | null {
    const nameMatch = text.match(/(?:Name|Customer|Client):\s*(.+?)(?:\s*\n|$)/i);
    if (!nameMatch) return null;

    const fullName = nameMatch[1].trim();
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const emailMatch = text.match(/(?:Email|E-mail):\s*(\S+@\S+)/i);
    const email = emailMatch ? emailMatch[1].trim() : "";

    const phoneMatch = text.match(/(?:Phone|Mobile|Contact):\s*([\d\s()+]+)/i);
    const phone = phoneMatch ? phoneMatch[1].trim().replace(/[\s()+-]/g, "") : "";

    const addressMatch = text.match(/(?:Address|Location|Suburb):\s*(.+?)(?:\s*\n|$)/i);
    const address = addressMatch ? addressMatch[1].trim() : "";

    let city = "";
    let state = "";
    let postcode = "";
    const stateMatch = address.match(/(.+?)\s+(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})/i);
    if (stateMatch) {
      city = stateMatch[1].split(",").pop()?.trim() || "";
      state = stateMatch[2].toUpperCase();
      postcode = stateMatch[3];
    }

    // Generate a unique ref from name + timestamp
    const leadRef = `GEN-${Date.now().toString(36)}`;

    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = String(now.getFullYear()).slice(2);
    const date = `${d}.${m}.${y}`;

    return {
      leadRef,
      source: "Email Lead",
      name: fullName,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      state,
      postcode,
      product: "",
      notes: "",
      date,
    };
  },
};

// ─── Parser Registry ──────────────────────────────────────────────────────────

/**
 * Ordered list of lead parsers. The first parser that matches wins.
 * Solar Quotes is first (most common), followed by other sources, with generic as fallback.
 */
export const LEAD_PARSERS: LeadParser[] = [
  solarQuotesParser,
  energyMattersParser,
  oneFlareParser,
  // Generic fallback — only used if no specific parser matches
  genericLeadParser,
];

/**
 * Try all registered parsers against an email and return the first successful match.
 */
export function parseLeadEmail(text: string, subject: string): ParsedLead | null {
  for (const parser of LEAD_PARSERS) {
    if (parser.canParse(text, subject)) {
      const result = parser.parse(text);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Get all unique IMAP search subjects from registered parsers.
 */
export function getSearchSubjects(): string[] {
  return LEAD_PARSERS
    .map(p => p.searchSubject)
    .filter(Boolean);
}
