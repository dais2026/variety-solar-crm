import { describe, it, expect } from "vitest";
import { parseLeadEmail, LEAD_PARSERS, getSearchSubjects } from "./leadParsers";

describe("leadParsers", () => {
  describe("getSearchSubjects", () => {
    it("returns non-empty subjects from registered parsers", () => {
      const subjects = getSearchSubjects();
      expect(subjects.length).toBeGreaterThan(0);
      expect(subjects).toContain("SolarQuotes");
      expect(subjects).toContain("Energy Matters");
      expect(subjects).toContain("Oneflare");
      // Generic parser has empty subject, should not be included
      subjects.forEach(s => expect(s).not.toBe(""));
    });
  });

  describe("LEAD_PARSERS registry", () => {
    it("has at least 3 specific parsers plus generic fallback", () => {
      expect(LEAD_PARSERS.length).toBeGreaterThanOrEqual(4);
      const ids = LEAD_PARSERS.map(p => p.sourceId);
      expect(ids).toContain("solar-quotes");
      expect(ids).toContain("energy-matters");
      expect(ids).toContain("one-flare");
      expect(ids).toContain("generic");
    });
  });

  describe("Solar Quotes parser", () => {
    const sampleEmail = `
New lead from SolarQuotes

Lead Ref: 1073194
Date: 2026-06-03

Name: Dave Collins
Email: dave@angrychair.com.au
Phone: 0401 835 272

Features:
On Grid Solar System
Battery Storage
EV Charger

Installation address:
208 Centre Dandenong Rd
Cheltenham VIC 3192
Australia

Special instructions from Dave:
I'm mostly keen on a smart EV charger in the short term. Solar is a longer term goal.

This lead was submitted on SolarQuotes.
    `.trim();

    it("detects Solar Quotes emails by subject", () => {
      const result = parseLeadEmail(sampleEmail, "New SolarQuotes Lead - Dave Collins");
      expect(result).not.toBeNull();
      expect(result!.source).toBe("Solar Quotes");
    });

    it("extracts lead reference", () => {
      const result = parseLeadEmail(sampleEmail, "SolarQuotes Lead");
      expect(result!.leadRef).toBe("1073194");
    });

    it("extracts name correctly", () => {
      const result = parseLeadEmail(sampleEmail, "SolarQuotes Lead");
      expect(result!.name).toBe("Dave Collins");
      expect(result!.firstName).toBe("Dave");
      expect(result!.lastName).toBe("Collins");
    });

    it("extracts email and phone", () => {
      const result = parseLeadEmail(sampleEmail, "SolarQuotes Lead");
      expect(result!.email).toBe("dave@angrychair.com.au");
      expect(result!.phone).toBe("0401835272");
    });

    it("extracts address with state and postcode", () => {
      const result = parseLeadEmail(sampleEmail, "SolarQuotes Lead");
      expect(result!.address).toContain("208 Centre Dandenong Rd");
      expect(result!.state).toBe("VIC");
      expect(result!.postcode).toBe("3192");
    });

    it("extracts product features", () => {
      const result = parseLeadEmail(sampleEmail, "SolarQuotes Lead");
      expect(result!.product).toContain("Solar");
    });

    it("extracts special instructions as notes", () => {
      const result = parseLeadEmail(sampleEmail, "SolarQuotes Lead");
      expect(result!.notes).toContain("EV charger");
    });

    it("formats date as DD.MM.YY", () => {
      const result = parseLeadEmail(sampleEmail, "SolarQuotes Lead");
      expect(result!.date).toBe("03.06.26");
    });
  });

  describe("Energy Matters parser", () => {
    const sampleEmail = `
New lead from Energy Matters

Reference: EM78432

Customer: John Smith
Email: john.smith@gmail.com
Phone: 0412 345 678
Address: 45 High St, Richmond VIC 3121

Interest: Solar + Battery
Notes: Looking for a 10kW system with battery storage for my 4-bedroom home.
---
    `.trim();

    it("detects Energy Matters emails by subject", () => {
      const result = parseLeadEmail(sampleEmail, "New Energy Matters Lead");
      expect(result).not.toBeNull();
      expect(result!.source).toBe("Energy Matters");
    });

    it("extracts reference with EM prefix", () => {
      const result = parseLeadEmail(sampleEmail, "Energy Matters Lead");
      expect(result!.leadRef).toBe("EM-EM78432");
    });

    it("extracts customer details", () => {
      const result = parseLeadEmail(sampleEmail, "Energy Matters Lead");
      expect(result!.name).toBe("John Smith");
      expect(result!.email).toBe("john.smith@gmail.com");
      expect(result!.phone).toBe("0412345678");
    });

    it("extracts address", () => {
      const result = parseLeadEmail(sampleEmail, "Energy Matters Lead");
      expect(result!.address).toContain("45 High St");
    });
  });

  describe("One Flare parser", () => {
    const sampleEmail = `
New job from Oneflare

Job #98765

Customer: Sarah Johnson
Email: sarah.j@outlook.com
Phone: 0423 456 789
Location: Hawthorn VIC 3122

Description: Need solar panels installed on my tile roof. Single storey house.
Budget: $5000-$10000
    `.trim();

    it("detects Oneflare emails by subject or content", () => {
      const result = parseLeadEmail(sampleEmail, "New Oneflare Job");
      expect(result).not.toBeNull();
      expect(result!.source).toBe("One Flare");
    });

    it("extracts reference with OF prefix", () => {
      const result = parseLeadEmail(sampleEmail, "Oneflare Job");
      expect(result!.leadRef).toBe("OF-98765");
    });

    it("extracts customer details", () => {
      const result = parseLeadEmail(sampleEmail, "Oneflare Job");
      expect(result!.name).toBe("Sarah Johnson");
      expect(result!.email).toBe("sarah.j@outlook.com");
      expect(result!.phone).toBe("0423456789");
    });
  });

  describe("Generic fallback parser", () => {
    const sampleEmail = `
Name: Michael Brown
Phone: 0434 567 890
Email: michael.b@test.com
Address: 12 Oak Ave, Camberwell VIC 3124
    `.trim();

    it("falls back to generic when no specific parser matches", () => {
      const result = parseLeadEmail(sampleEmail, "Random Lead Email");
      expect(result).not.toBeNull();
      expect(result!.source).toBe("Email Lead");
    });

    it("extracts basic contact info", () => {
      const result = parseLeadEmail(sampleEmail, "Random Lead Email");
      expect(result!.name).toBe("Michael Brown");
      expect(result!.email).toBe("michael.b@test.com");
      expect(result!.phone).toBe("0434567890");
    });

    it("generates a unique lead ref with GEN prefix", () => {
      const result = parseLeadEmail(sampleEmail, "Random Lead Email");
      expect(result!.leadRef).toMatch(/^GEN-/);
    });
  });

  describe("parseLeadEmail priority", () => {
    it("returns null for non-lead emails", () => {
      const result = parseLeadEmail("Hello, just checking in!", "Hi there");
      expect(result).toBeNull();
    });

    it("prioritizes Solar Quotes over generic when both could match", () => {
      const text = `
Lead Ref: 999999
Name: Test User
Email: test@test.com
Phone: 0400 000 000
SolarQuotes
      `.trim();
      const result = parseLeadEmail(text, "SolarQuotes Lead");
      expect(result).not.toBeNull();
      expect(result!.source).toBe("Solar Quotes");
    });
  });
});
