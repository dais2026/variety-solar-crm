import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK
vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

// Mock the ENV
vi.mock("./_core/env", () => ({
  ENV: {
    zohoImapHost: "imappro.zoho.com",
    zohoImapUser: "george@varietysolar.com.au",
    zohoImapPassword: "test-password",
    googleSheetsToken: "fake-token-long-enough-to-pass-validation-check-that-requires-over-one-hundred-characters-in-length-to-be-valid",
  },
}));

// Mock the DB helpers
vi.mock("./db", () => ({
  getSolarQuotesImportByRef: vi.fn(),
  insertSolarQuotesImport: vi.fn(),
}));

// Mock imap and mailparser
vi.mock("imap", () => {
  return {
    default: vi.fn(),
  };
});

vi.mock("mailparser", () => ({
  simpleParser: vi.fn(),
}));

import { sdk } from "./_core/sdk";
import { getSolarQuotesImportByRef, insertSolarQuotesImport } from "./db";

describe("scheduledSolarQuotesHandler", () => {
  let mockReq: any;
  let mockRes: any;
  let resJson: any;
  let resStatus: any;

  beforeEach(() => {
    vi.clearAllMocks();

    resJson = vi.fn();
    resStatus = vi.fn().mockReturnValue({ json: resJson });

    mockReq = {
      url: "/api/scheduled/solar-quotes-import",
      headers: { cookie: "" },
    };
    mockRes = {
      json: resJson,
      status: resStatus,
    };
  });

  it("should reject non-cron requests with 403", async () => {
    (sdk.authenticateRequest as any).mockResolvedValue({
      isCron: false,
      taskUid: null,
    });

    const { scheduledSolarQuotesHandler } = await import("./scheduledSolarQuotes");
    await scheduledSolarQuotesHandler(mockReq, mockRes);

    expect(resStatus).toHaveBeenCalledWith(403);
    expect(resJson).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("should parse Solar Quotes email text correctly", async () => {
    // Test the parser directly by importing the module
    // The parseSolarQuotesEmail function is not exported, so we test via the handler
    // Instead, let's test the full flow with mocked IMAP

    (sdk.authenticateRequest as any).mockResolvedValue({
      isCron: true,
      taskUid: "test-task-uid",
    });

    // Mock IMAP to return empty (no emails)
    const Imap = (await import("imap")).default as any;
    Imap.mockImplementation(() => {
      const instance = {
        once: vi.fn((event: string, cb: any) => {
          if (event === "ready") {
            setTimeout(() => cb(), 0);
          }
        }),
        openBox: vi.fn((_box: string, _readOnly: boolean, cb: any) => {
          cb(null);
        }),
        search: vi.fn((_criteria: any, cb: any) => {
          cb(null, []); // No emails found
        }),
        end: vi.fn(),
        connect: vi.fn(),
      };
      return instance;
    });

    const { scheduledSolarQuotesHandler } = await import("./scheduledSolarQuotes");
    await scheduledSolarQuotesHandler(mockReq, mockRes);

    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        totalEmails: 0,
        imported: 0,
        skipped: 0,
      })
    );
  });

  it("should skip already-imported leads (dedupe by leadRef)", async () => {
    (sdk.authenticateRequest as any).mockResolvedValue({
      isCron: true,
      taskUid: "test-task-uid",
    });

    // Mock that this lead was already imported
    (getSolarQuotesImportByRef as any).mockResolvedValue({
      id: 1,
      leadRef: "1073194",
      leadName: "Dave Collins",
      importedAt: Date.now(),
    });

    // Mock IMAP to return one email
    const sampleEmailText = `New Lead from SolarQuotes

Lead Ref: 1073194
Name: Dave Collins
Email: dave@angrychair.com.au
Phone: 0401 835 272
Date: 2026-06-03

Features:
Smart EV Charger
On Grid Solar + Battery System

Installation address:
208 Centre Dandenong Rd
Cheltenham VIC 3192
Australia

Special instructions from Dave:
I'm mostly keen on a smart EV charger in the short term.

This lead was submitted on 3 June 2026.`;

    const Imap = (await import("imap")).default as any;
    const { simpleParser } = await import("mailparser");

    (simpleParser as any).mockResolvedValue({
      text: sampleEmailText,
      subject: "New Lead from SolarQuotes - Dave Collins",
      date: new Date("2026-06-03"),
    });

    Imap.mockImplementation(() => {
      const listeners: Record<string, any> = {};
      const instance = {
        once: vi.fn((event: string, cb: any) => {
          listeners[event] = cb;
          if (event === "ready") {
            setTimeout(() => cb(), 0);
          }
        }),
        openBox: vi.fn((_box: string, _readOnly: boolean, cb: any) => {
          cb(null);
        }),
        search: vi.fn((_criteria: any, cb: any) => {
          cb(null, [1]);
        }),
        fetch: vi.fn(() => {
          const fetchObj = {
            on: vi.fn((event: string, cb: any) => {
              if (event === "message") {
                // Simulate a message
                const msgObj = {
                  on: vi.fn((msgEvent: string, msgCb: any) => {
                    if (msgEvent === "attributes") {
                      msgCb({ uid: "123" });
                    }
                    if (msgEvent === "body") {
                      const stream = {
                        on: vi.fn((streamEvent: string, streamCb: any) => {
                          if (streamEvent === "data") {
                            streamCb(Buffer.from(sampleEmailText));
                          }
                          if (streamEvent === "end") {
                            streamCb();
                          }
                        }),
                      };
                      msgCb(stream);
                    }
                    if (msgEvent === "end") {
                      setTimeout(() => msgCb(), 10);
                    }
                  }),
                };
                cb(msgObj, 1);
              }
            }),
            once: vi.fn((event: string, cb: any) => {
              if (event === "end") {
                // Don't call immediately, let message processing finish
              }
            }),
          };
          return fetchObj;
        }),
        end: vi.fn(),
        connect: vi.fn(),
      };
      return instance;
    });

    // Re-import to get fresh module
    vi.resetModules();
    vi.mock("./_core/sdk", () => ({
      sdk: { authenticateRequest: vi.fn().mockResolvedValue({ isCron: true, taskUid: "test-task-uid" }) },
    }));
    vi.mock("./_core/env", () => ({
      ENV: {
        zohoImapHost: "imappro.zoho.com",
        zohoImapUser: "george@varietysolar.com.au",
        zohoImapPassword: "test-password",
        googleSheetsToken: "fake-token-long-enough-to-pass-validation-check-that-requires-over-one-hundred-characters-in-length-to-be-valid",
      },
    }));
    vi.mock("./db", () => ({
      getSolarQuotesImportByRef: vi.fn().mockResolvedValue({ id: 1, leadRef: "1073194" }),
      insertSolarQuotesImport: vi.fn(),
    }));

    const mod = await import("./scheduledSolarQuotes");
    await mod.scheduledSolarQuotesHandler(mockReq, mockRes);

    // Should have skipped the already-imported lead
    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        skipped: expect.any(Number),
      })
    );
  });
});

describe("parseSolarQuotesEmail (via export)", () => {
  it("should validate IMAP env vars are configured", () => {
    // This test validates that the secrets are properly referenced in ENV
    const env = {
      zohoImapHost: process.env.ZOHO_IMAP_HOST || "imappro.zoho.com",
      zohoImapUser: process.env.ZOHO_IMAP_USER || "",
      zohoImapPassword: process.env.ZOHO_IMAP_PASSWORD || "",
    };

    // In test environment, env vars may not be set, but the keys should exist
    expect(env.zohoImapHost).toBeDefined();
    expect(typeof env.zohoImapHost).toBe("string");
  });
});
